declare module 'react-plotly.js' {
  import * as React from 'react';
  interface PlotlyHTMLElement extends HTMLElement {
    on(event: string, callback: (eventData: any) => void): void;
  }
  interface PlotParams {
    data: any[];
    layout: any;
    config?: any;
    frames?: any[];
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
    className?: string;
    onInitialized?: (figure: any, graphDiv: PlotlyHTMLElement) => void;
    onUpdate?: (figure: any, graphDiv: PlotlyHTMLElement) => void;
    onPurge?: (figure: any, graphDiv: PlotlyHTMLElement) => void;
    onError?: (err: any) => void;
  }
  export default class Plot extends React.Component<PlotParams, any> {}
}

declare module 'plotly.js-dist-min' {
  const Plotly: any;
  export default Plotly;
}

declare module 'react-plotly.js/factory' {
  const createPlotlyComponent: (plotly: any) => any;
  export default createPlotlyComponent;
}
