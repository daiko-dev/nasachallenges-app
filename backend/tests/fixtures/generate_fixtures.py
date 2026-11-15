import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from pathlib import Path

fixtures_dir = Path(__file__).parent
fixtures_dir.mkdir(parents=True, exist_ok=True)

# 1. Generate 6-extension sample FITS cutout
fits_path = fixtures_dir / "sample_cutout.fits"

# Primary / IMAGE
w = WCS(naxis=2)
w.wcs.crpix = [30.0, 30.0]
w.wcs.cdelt = [-6.2 / 3600.0, 6.2 / 3600.0]
w.wcs.crval = [210.802, 54.349]
w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
header = w.to_header()
header["EXTNAME"] = "IMAGE"
header["LAMBDA"] = 1.420  # um
header["BANDWID"] = 0.035 # um
header["DETECTOR"] = 3
header["OBSID"] = "SPX_M101_001"

# 60x60 image data with background noise + a centered point source
np.random.seed(42)
img_data = np.random.normal(loc=10.0, scale=1.5, size=(60, 60)).astype(np.float32)
# Add star at center (30, 30)
y, x = np.mgrid[0:60, 0:60]
star = 80.0 * np.exp(-((x - 30)**2 + (y - 30)**2) / (2 * 1.5**2))
img_data += star.astype(np.float32)

primary_hdu = fits.PrimaryHDU(data=img_data, header=header)

# Extension 1: FLAGS (0 = good, 1 = bad/dead, 2 = saturated)
flags_data = np.zeros((60, 60), dtype=np.uint16)
flags_data[0, :] = 1
flags_data[-1, :] = 1
flags_data[:, 0] = 1
flags_data[:, -1] = 1
flags_data[5, 5] = 2  # one bad pixel
flags_hdu = fits.ImageHDU(data=flags_data, name="FLAGS")

# Extension 2: VARIANCE
var_data = np.full((60, 60), 2.25, dtype=np.float32)
var_hdu = fits.ImageHDU(data=var_data, name="VARIANCE")

# Extension 3: ZODI
zodi_data = np.full((60, 60), 4.5, dtype=np.float32)
zodi_hdu = fits.ImageHDU(data=zodi_data, name="ZODI")

# Extension 4: EPSF / PSF (21x21)
py, px = np.mgrid[-10:11, -10:11]
psf_data = np.exp(-(px**2 + py**2) / (2 * 1.5**2)).astype(np.float32)
psf_data /= psf_data.sum()
psf_hdu = fits.ImageHDU(data=psf_data, name="EPSF")

# Extension 5: WCS-WAVE
wave_header = fits.Header()
wave_header["EXTNAME"] = "WCS-WAVE"
wave_header["CRPIX1"] = 30.0
wave_header["CRVAL1"] = 1.420
wave_header["CDELT1"] = 0.001
wave_header["CTYPE1"] = "WAVE"
wave_header["CUNIT1"] = "um"
wave_header["LAMBDA"] = 1.420
wave_header["BANDWID"] = 0.035
wave_hdu = fits.ImageHDU(data=np.linspace(1.39, 1.45, 60, dtype=np.float32), header=wave_header, name="WCS-WAVE")

hdul = fits.HDUList([primary_hdu, flags_hdu, var_hdu, zodi_hdu, psf_hdu, wave_hdu])
hdul.writeto(fits_path, overwrite=True)
print(f"Created sample FITS: {fits_path} with {len(hdul)} extensions")

# 2. Generate sample VOTable XML
votable_path = fixtures_dir / "sample_sia_votable.xml"
votable_xml = """<?xml version="1.0" encoding="utf-8"?>
<VOTABLE version="1.4" xmlns="http://www.ivoa.net/xml/VOTable/v1.4">
  <RESOURCE type="results">
    <TABLE ID="sia_results">
      <FIELD name="obs_publisher_did" datatype="char" arraysize="*"/>
      <FIELD name="collection" datatype="char" arraysize="*"/>
      <FIELD name="access_url" datatype="char" arraysize="*"/>
      <FIELD name="t_mjd" datatype="double"/>
      <FIELD name="s_ra" datatype="double"/>
      <FIELD name="s_dec" datatype="double"/>
      <FIELD name="detector" datatype="int"/>
      <FIELD name="em_min" datatype="double"/>
      <FIELD name="em_max" datatype="double"/>
      <DATA>
        <TABLEDATA>
          <TR>
            <TD>ivo://irsa.ipac/spherex/level2_SPX001D3_spx_l2b-60400</TD>
            <TD>spherex_dr1</TD>
            <TD>https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/SPX001D3.fits</TD>
            <TD>60400.25</TD>
            <TD>210.8023</TD>
            <TD>54.3490</TD>
            <TD>3</TD>
            <TD>1.40e-6</TD>
            <TD>1.44e-6</TD>
          </TR>
          <TR>
            <TD>ivo://irsa.ipac/spherex/level2_SPX002D3_spx_l2b-60580</TD>
            <TD>spherex_dr1</TD>
            <TD>https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/SPX002D3.fits</TD>
            <TD>60580.45</TD>
            <TD>210.8021</TD>
            <TD>54.3491</TD>
            <TD>3</TD>
            <TD>1.40e-6</TD>
            <TD>1.44e-6</TD>
          </TR>
          <TR>
            <TD>ivo://irsa.ipac/spherex/level2_SPX003D1_spx_l2b-60720</TD>
            <TD>spherex_qr3</TD>
            <TD>https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/SPX003D1.fits</TD>
            <TD>60720.10</TD>
            <TD>210.8025</TD>
            <TD>54.3488</TD>
            <TD>1</TD>
            <TD>0.95e-6</TD>
            <TD>1.02e-6</TD>
          </TR>
        </TABLEDATA>
      </DATA>
    </TABLE>
  </RESOURCE>
</VOTABLE>
"""
votable_path.write_text(votable_xml, encoding="utf-8")
print(f"Created sample VOTable: {votable_path}")
