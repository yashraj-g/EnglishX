"""OpenTelemetry setup for ms2-speech-agent."""
import logging
from fastapi import FastAPI

try:
    from app.config import settings
except ImportError:
    # Fallback for IDEs or direct script execution
    from config import settings

logger = logging.getLogger(__name__)

def init_otel(app: FastAPI):
    """Initialize OpenTelemetry tracing for the FastAPI app."""
    if not settings.otel_exporter_otlp_endpoint:
        logger.info("OpenTelemetry: No endpoint configured, tracing disabled")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        resource = Resource.create({"service.name": settings.otel_service_name})

        provider = TracerProvider(resource=resource)
        exporter = OTLPSpanExporter(
            endpoint=f"{settings.otel_exporter_otlp_endpoint}/v1/traces"
        )
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)

        FastAPIInstrumentor.instrument_app(app)

        logger.info(f"OpenTelemetry: Tracing enabled → {settings.otel_exporter_otlp_endpoint}")

    except ImportError:
        logger.warning("OpenTelemetry: Dependencies not installed, tracing disabled")
    except Exception as e:
        logger.warning(f"OpenTelemetry: Failed to initialize: {e}")
