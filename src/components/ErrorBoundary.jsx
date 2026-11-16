import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Page crashed:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-center">
          <p className="text-slate-700 font-semibold">This page failed to load.</p>
          <p className="text-xs text-slate-500 mt-1">{String(this.state.error.message || this.state.error)}</p>
          <button onClick={() => this.setState({ error: null })}
            className="mt-3 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
