from .applications    import applications_bp
from .auth            import auth_bp
from .contracts       import contracts_bp
from .dashboard       import dashboard_bp
from .invoices        import invoices_bp
from .items           import items_bp
from .payments        import payments_bp
from .purchase_orders import purchase_orders_bp
from .receipts        import receipts_bp
from .reports         import reports_bp
from .suppliers       import suppliers_bp


__all__ = [
    "applications_bp",
    "auth_bp",
    "contracts_bp",
    "dashboard_bp",
    "invoices_bp",
    "items_bp",
    "payments_bp",
    "purchase_orders_bp",
    "receipts_bp",
    "reports_bp",
    "suppliers_bp",
]
