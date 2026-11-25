"""Pressure drop across heat exchanger, furnace, and piping."""

def pressure_drop_psi(cv_psi: float, hx_psi: float, furnace_psi: float, misc_psi: float = 5) -> float:
    return cv_psi + hx_psi + furnace_psi + misc_psi
