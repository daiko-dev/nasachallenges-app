import re
import io
from dataclasses import dataclass
from typing import List, Tuple, Optional
from astropy.io.votable import parse_single_table
import httpx

class UpstreamIRSAError(Exception):
    """Raised when upstream IRSA SIA2 service times out or is unreachable."""
    pass

@dataclass
class EpochRecord:
    obs_id: str
    collection: str
    access_url: str
    t_mjd: float
    detector: int
    s_ra: float
    s_dec: float
    em_min: float
    em_max: float

def normalize_ra(ra: float) -> float:
    """Wraps Right Ascension to [0, 360)."""
    norm = ra % 360.0
    return norm + 360.0 if norm < 0 else norm

def parse_detector(identifier: str) -> int:
    """Extracts detector number (1-6) from SPHEREx observation identifier/filename."""
    match = re.search(r"D([1-6])", identifier)
    if match:
        return int(match.group(1))
    return 1

def search_epochs_from_votable(content: str) -> List[EpochRecord]:
    """Parses an IVOA VOTable XML string into sorted EpochRecords."""
    if not content or not content.strip():
        return []
    
    try:
        table = parse_single_table(io.BytesIO(content.encode("utf-8")), verify="ignore").to_table()
    except Exception:
        return []
    
    if len(table) == 0:
        return []
    
    records: List[EpochRecord] = []
    col_names = [c.lower() for c in table.colnames]
    
    def get_val(row, key_candidates, default):
        for k in key_candidates:
            if k in col_names:
                actual_name = table.colnames[col_names.index(k)]
                val = row[actual_name]
                if hasattr(val, "decode"):
                    val = val.decode("utf-8")
                return val
        return default

    for row in table:
        obs_id = str(get_val(row, ["obs_publisher_did", "obs_id", "obsid"], "SPX_UNKNOWN"))
        collection = str(get_val(row, ["collection", "obs_collection"], "spherex_dr1"))
        access_url = str(get_val(row, ["access_url", "accessurl"], ""))
        t_mjd = float(get_val(row, ["t_mjd", "mjd", "time"], 60000.0))
        s_ra = float(get_val(row, ["s_ra", "ra"], 0.0))
        s_dec = float(get_val(row, ["s_dec", "dec"], 0.0))
        em_min = float(get_val(row, ["em_min", "lambda_min"], 1.0e-6))
        em_max = float(get_val(row, ["em_max", "lambda_max"], 1.1e-6))
        
        det_val = get_val(row, ["detector"], None)
        if det_val is not None:
            try:
                det = int(det_val)
            except (ValueError, TypeError):
                det = parse_detector(obs_id)
        else:
            det = parse_detector(obs_id)
            
        records.append(EpochRecord(
            obs_id=obs_id,
            collection=collection,
            access_url=access_url,
            t_mjd=t_mjd,
            detector=det,
            s_ra=s_ra,
            s_dec=s_dec,
            em_min=em_min,
            em_max=em_max
        ))
        
    records.sort(key=lambda r: r.t_mjd)
    return records

def search_epochs(
    ra: float,
    dec: float,
    radius_deg: float = 0.05,
    collections: Tuple[str, ...] = ("spherex_dr1", "spherex_qr3"),
    timeout_s: float = 10.0
) -> List[EpochRecord]:
    """Queries IRSA SIA2 service for SPHEREx epochs."""
    norm_ra = normalize_ra(ra)
    coll_param = ",".join(collections)
    url = f"https://irsa.ipac.caltech.edu/SIA?COLLECTION={coll_param}&POS=circle+{norm_ra:.5f}+{dec:.5f}+{radius_deg:.4f}"
    
    try:
        resp = httpx.get(url, timeout=timeout_s, headers={"Accept": "application/x-votable+xml"})
        if resp.status_code == 200:
            return search_epochs_from_votable(resp.text)
        elif resp.status_code >= 500:
            raise UpstreamIRSAError(f"IRSA responded with status {resp.status_code}")
    except httpx.TimeoutException as exc:
        raise UpstreamIRSAError(f"IRSA request timed out: {exc}") from exc
    except httpx.RequestError as exc:
        raise UpstreamIRSAError(f"Network error contacting IRSA: {exc}") from exc
    return []
