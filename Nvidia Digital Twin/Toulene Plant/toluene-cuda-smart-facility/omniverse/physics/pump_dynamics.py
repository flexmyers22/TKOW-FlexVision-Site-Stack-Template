"""Pump dynamics — flow vs pressure for P101."""

def pump_discharge_pressure(inlet_psi: float, motor_kw: float) -> float:
    return inlet_psi + motor_kw * 15
