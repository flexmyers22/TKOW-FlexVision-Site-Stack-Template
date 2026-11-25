"""Distillation column flooding and reflux model."""


def flooding_risk(reflux_ratio: float, feed_lb_hr: float, diameter_m: float) -> float:
    """Return 0-1 flooding risk score."""
    loading = feed_lb_hr / max(diameter_m ** 2, 0.01)
    return min(1.0, loading / (reflux_ratio * 500))
