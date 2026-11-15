from typing import Literal, Optional, List, Tuple
from pydantic import BaseModel, Field

Release = Literal["dr1", "qr3"]

class Epoch(BaseModel):
    id: str
    obsId: str
    utc: str
    release: Release
    detector: Literal[1, 2, 3, 4, 5, 6]
    lambdaUm: float
    bandwidthUm: float
    frameUrl: str
    sourceUrl: str

class CandidateTrackPoint(BaseModel):
    epochId: str
    x: float
    y: float
    ra: float
    dec: float

class CandidateMatch(BaseModel):
    catalog: str
    name: str
    sepArcsec: float

class CandidateExplanation(BaseModel):
    text: str
    source: Literal["template", "llm"]

class Candidate(BaseModel):
    id: str
    kind: Literal["moved_source", "unmatched_source"]
    status: Literal["candidate"] = "candidate"
    track: List[CandidateTrackPoint]
    snr: float
    match: Optional[CandidateMatch] = None
    explanation: Optional[CandidateExplanation] = None

class GridInfo(BaseModel):
    widthPx: int = 60
    heightPx: int = 60
    pixScaleArcsec: float = 6.2

class ProvenanceInfo(BaseModel):
    collection: str = "spherex_dr1"
    retrievedUtc: str
    synthetic: bool = False
    credit: str = "SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive"

class FieldManifest(BaseModel):
    schemaVersion: Literal["1.0"] = "1.0"
    id: str
    name: str
    ra: float
    dec: float
    fovDeg: float
    grid: GridInfo = Field(default_factory=GridInfo)
    epochs: List[Epoch]
    matchedPairs: List[Tuple[str, str]]
    candidates: List[Candidate] = Field(default_factory=list)
    message: Optional[str] = None
    provenance: ProvenanceInfo

    @property
    def fieldId(self) -> str:
        return self.id

class HealthStatus(BaseModel):
    irsa: Literal["up", "down"]
    checkedUtc: str
