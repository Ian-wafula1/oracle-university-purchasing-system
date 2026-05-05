import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from utils.responses import configure_json

from routes.auth            import auth_bp
from routes.suppliers       import suppliers_bp
from routes.applications    import applications_bp
from routes.items           import items_bp
from routes.contracts       import contracts_bp
from routes.purchase_orders import purchase_orders_bp
from routes.invoices        import invoices_bp
from routes.payments        import payments_bp
from routes.receipts        import receipts_bp
from routes.reports         import reports_bp
from routes.dashboard       import dashboard_bp

load_dotenv()


def create_app():
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS(
        app,
        resources={r"/api/*": {"origins": os.getenv("CORS_ORIGIN", "http://localhost:8080")}},
        supports_credentials=True,
    )

    configure_json(app)

    # ── Blueprints ────────────────────────────────────────────────────────────
    app.register_blueprint(auth_bp)
    app.register_blueprint(suppliers_bp)
    app.register_blueprint(applications_bp)
    app.register_blueprint(items_bp)
    app.register_blueprint(contracts_bp)
    app.register_blueprint(purchase_orders_bp)
    app.register_blueprint(invoices_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(receipts_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(dashboard_bp)

    # ── Convenience: wire up the two contract-item sub-routes ─────────────────
    # DELETE /api/contract-items/<id>  (defined inside contracts_bp)
    from routes.contracts import delete_contract_item
    app.add_url_rule(
        "/api/contract-items/<int:contract_item_id>",
        view_func=delete_contract_item,
        methods=["DELETE"],
    )

    # PUT|DELETE /api/order-details/<id>  (defined inside purchase_orders_bp)
    from routes.purchase_orders import update_po_detail, delete_po_detail
    app.add_url_rule(
        "/api/order-details/<int:detail_id>",
        view_func=update_po_detail,
        methods=["PUT"],
    )
    app.add_url_rule(
        "/api/order-details/<int:detail_id>",
        view_func=delete_po_detail,
        methods=["DELETE"],
    )

    # ── Global error handlers ─────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found_handler(e):
        return jsonify({"success": False, "error": "Endpoint not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"success": False, "error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"success": False, "error": "Internal server error", "details": str(e)}), 500

    # ── Health check ──────────────────────────────────────────────────────────
    @app.route("/api/health", methods=["GET"])
    def health():
        try:
            from utils.db import get_db
            with get_db() as conn:
                conn.cursor().execute("SELECT 1")
            db_status = "connected"
        except Exception as ex:
            db_status = f"error: {ex}"

        return jsonify({
            "status": "ok",
            "db":     db_status,
            "env":    os.getenv("FLASK_ENV", "production"),
        })

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(
        host="0.0.0.0",
        port=int(os.getenv("FLASK_PORT", 5000)),
        debug=os.getenv("FLASK_ENV") == "development",
    )
