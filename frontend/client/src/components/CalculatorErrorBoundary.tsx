import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CalculatorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Calculator Error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/calculator";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[var(--color-cream-main)] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-[var(--color-border-light)] shadow-sm text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-serif text-[var(--color-navy-900)] mb-3">
              Something went wrong
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-6">
              We encountered an error while processing your calculation. Your data is safe.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                className="bg-[var(--color-teal-600)] text-white"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Start Over
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = "/"}
              >
                Go Home
              </Button>
            </div>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer">
                  Error Details (Dev Only)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
