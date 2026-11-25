"""Reactor thermal simulation for Omniverse PhysX / thermal extension."""

def reactor_heat_outlet(inlet_temp_f: float, duty_kw: float, flow_lb_hr: float) -> float:
    """Simplified outlet temperature model."""
    delta = duty_kw / max(flow_lb_hr, 1) * 0.05
    return inlet_temp_f + delta
