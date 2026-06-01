"use client";
import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 20px",
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            minHeight: "200px",
          }}
        >
          <span style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</span>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "14px",
              textAlign: "center",
              marginBottom: "16px",
            }}
          >
            เกิดข้อผิดพลาด กรุณา refresh หน้านี้
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "var(--accent)",
              border: "none",
              borderRadius: "var(--radius)",
              padding: "8px 20px",
              color: "#fff",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            รีโหลดหน้า
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC to wrap components with ErrorBoundary easily
export function withErrorBoundary(Component, fallback) {
  return function WrappedComponent(props) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
