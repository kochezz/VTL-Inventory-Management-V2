'use client';

import { Component, ReactNode } from 'react';

// React error boundaries must be class components -- there is no hooks
// equivalent of getDerivedStateFromError/componentDidCatch. Wrapping each
// row/card individually (rather than one boundary around the whole list,
// or a route-level error.tsx) means one malformed row shows its own
// fallback while every other row keeps rendering normally -- the actual
// bug this exists for was a single unguarded .replace() call on a null
// field inside an Array.map, which took down the entire Approvals page
// for every row, not just the one with bad data.
//
// In the happy path this renders nothing of its own -- just its children
// -- so it adds no extra DOM node and is safe to place directly inside a
// <tbody> (wrapping a <tr>) or a list of <div> cards alike. `fallback` is
// supplied by the caller so it can match whatever the row's own markup
// shape is (a <tr> for a table, a <div> for a card list).
interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}

export class RowErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Compliance row failed to render:', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
