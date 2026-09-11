import { Component } from 'react';
import { reportError } from '../lib/crash';
import CrashScreen from './CrashScreen';

/**
 * Catches a render error anywhere below it.
 *
 * React unmounts the whole tree when a render throws and nothing catches it —
 * which is why an unhandled error shows a white screen rather than a broken
 * one. This is the only mechanism React offers to stop that, and it has to be
 * a class: there is no hook equivalent of componentDidCatch.
 *
 * `resetKey` is bumped on "Try again" so the children remount rather than
 * re-rendering the same failed state straight back into the same error.
 *
 * Note what it does NOT catch: errors thrown in event handlers, in promises, or
 * in async callbacks. Those need their own try/catch — which is why
 * `reportError` is exported separately.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportError(error, this.props.where || 'render');
    if (__DEV__) console.error(error, info?.componentStack);
  }

  handleReset = () => {
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <CrashScreen
          onReset={this.handleReset}
          detail={__DEV__ ? this.state.error.message : null}
        />
      );
    }

    return <ErrorBoundaryChildren key={this.state.resetKey}>{this.props.children}</ErrorBoundaryChildren>;
  }
}

/** Remounting the subtree is the point of the key; this just carries it. */
function ErrorBoundaryChildren({ children }) {
  return children;
}
