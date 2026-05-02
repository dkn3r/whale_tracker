import { shortAddr } from './utils.js';

/**
 * Render the whale address relationship network.
 * @param {{ nodes: Array, edges: Array }} networkData
 * @param {Function} onNodeClick  called with address string when a node is clicked
 */
export function initNetwork({ nodes, edges }, onNodeClick) {
  const svgEl  = document.getElementById('network-svg');
  const W      = svgEl.clientWidth || 900;
  const H      = 400;
  const tooltip = document.getElementById('net-tooltip');

  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);

  // Radial gradient for nodes
  const defs = svg.append('defs');
  const rg   = defs.append('radialGradient').attr('id', 'nodeGrad');
  rg.append('stop').attr('offset', '0%').attr('stop-color', '#00ffaa').attr('stop-opacity', .55);
  rg.append('stop').attr('offset', '100%').attr('stop-color', '#00d4ff').attr('stop-opacity', .08);

  const maxSent = Math.max(...nodes.map((n) => n.sent), 1);
  const maxW    = Math.max(...edges.map((e) => e.weight), 1);
  const rScale  = d3.scaleSqrt().domain([0, maxSent]).range([8, 34]);

  const sim = d3.forceSimulation(nodes)
    .force('link',      d3.forceLink(edges).id((d) => d.id).distance(90).strength(.4))
    .force('charge',    d3.forceManyBody().strength(-220))
    .force('center',    d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide().radius((d) => rScale(d.sent) + 8));

  // Edges
  const link = svg.append('g').selectAll('line').data(edges).join('line')
    .attr('stroke',       (e) => e.weight > 3 ? 'rgba(0,255,170,.30)' : 'rgba(0,212,255,.12)')
    .attr('stroke-width', (e) => Math.max(1, (e.weight / maxW) * 4));

  // Nodes
  const node = svg.append('g').selectAll('g').data(nodes).join('g')
    .style('cursor', 'pointer')
    .call(
      d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }),
    );

  const topSent = Math.max(...nodes.map((n) => n.sent));

  node.append('circle')
    .attr('r',            (d) => rScale(d.sent))
    .attr('fill',         'url(#nodeGrad)')
    .attr('stroke',       (d) => d.sent === topSent ? '#ffd700' : 'rgba(0,255,170,.4)')
    .attr('stroke-width', 1.5)
    .on('mousemove', (e, d) => {
      tooltip.style.display = 'block';
      tooltip.style.left    = `${e.clientX + 14}px`;
      tooltip.style.top     = `${e.clientY - 10}px`;
      tooltip.innerHTML     =
        `<div class="nt-addr">${shortAddr(d.id)}</div>
         <div class="nt-row">Sent: <span>${Math.round(d.sent).toLocaleString()} Ξ</span></div>
         <div class="nt-row">Received: <span>${Math.round(d.recv).toLocaleString()} Ξ</span></div>
         <div class="nt-row">TX count: <span>${d.txCount}</span></div>
         <div style="margin-top:6px;font-size:10px;color:var(--muted)">Click to view profile</div>`;
    })
    .on('mouseleave', () => { tooltip.style.display = 'none'; })
    .on('click', (_, d) => onNodeClick(d.id));

  node.append('text')
    .attr('dy',           (d) => rScale(d.sent) + 12)
    .attr('text-anchor',  'middle')
    .attr('fill',         '#5a6a8a')
    .attr('font-size',    9)
    .attr('font-family',  "'Share Tech Mono', monospace")
    .style('pointer-events', 'none')
    .text((d) => shortAddr(d.id));

  sim.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
    node.attr('transform', (d) =>
      `translate(${Math.max(36, Math.min(W - 36, d.x))},${Math.max(36, Math.min(H - 36, d.y))})`);
  });
}
