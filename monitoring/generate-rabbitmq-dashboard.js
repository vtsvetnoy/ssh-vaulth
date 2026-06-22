const fs = require('fs');

const datasource = { type: 'prometheus', uid: 'ee4pwadejjcaob' };
const selector = 'project=~"$project",instance=~"$instance"';
const queueSelector = `${selector},vhost=~"$vhost",queue=~"$queue"`;

let panelId = 1;

function target(expr, refId = 'A', legendFormat = '') {
  return {
    datasource,
    editorMode: 'code',
    expr,
    instant: false,
    legendFormat,
    range: true,
    refId,
  };
}

function stat(title, expr, x, unit = 'short', thresholds) {
  return {
    id: panelId++,
    title,
    type: 'stat',
    datasource,
    gridPos: { h: 4, w: 4, x, y: 0 },
    fieldConfig: {
      defaults: {
        unit,
        color: { mode: 'thresholds' },
        thresholds: thresholds || {
          mode: 'absolute',
          steps: [{ color: 'green', value: null }, { color: 'red', value: 1 }],
        },
      },
      overrides: [],
    },
    options: {
      colorMode: 'background',
      graphMode: 'area',
      justifyMode: 'auto',
      orientation: 'horizontal',
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
      textMode: 'auto',
    },
    targets: [{ ...target(expr), instant: true, range: false }],
  };
}

function timeseries(title, targets, x, y, w = 12, unit = 'ops') {
  return {
    id: panelId++,
    title,
    type: 'timeseries',
    datasource,
    gridPos: { h: 8, w, x, y },
    fieldConfig: {
      defaults: {
        unit,
        color: { mode: 'palette-classic' },
        custom: {
          axisCenteredZero: false,
          axisColorMode: 'text',
          axisLabel: '',
          axisPlacement: 'auto',
          drawStyle: 'line',
          fillOpacity: 12,
          lineInterpolation: 'smooth',
          lineWidth: 2,
          pointSize: 4,
          showPoints: 'never',
          spanNulls: true,
          stacking: { group: 'A', mode: 'none' },
        },
      },
      overrides: [],
    },
    options: {
      legend: { calcs: ['lastNotNull'], displayMode: 'table', placement: 'bottom', showLegend: true },
      tooltip: { mode: 'multi', sort: 'desc' },
    },
    targets,
  };
}

function table(title, targets, x, y, w = 24, h = 10, transformations = []) {
  return {
    id: panelId++,
    title,
    type: 'table',
    datasource,
    gridPos: { h, w, x, y },
    fieldConfig: {
      defaults: { custom: { align: 'auto', cellOptions: { type: 'auto' }, inspect: false } },
      overrides: [],
    },
    options: { cellHeight: 'sm', footer: { countRows: false, fields: '', reducer: ['sum'], show: false }, showHeader: true },
    targets: targets.map((item) => ({ ...item, format: 'table', instant: true, range: false })),
    transformations,
  };
}

const panels = [
  stat('Exporter targets UP', `sum(up{job="rabbitmq",${selector}})`, 0, 'short', {
    mode: 'absolute',
    steps: [{ color: 'red', value: null }, { color: 'green', value: 1 }],
  }),
  stat('Queues', `sum(rabbitmq_queues{job="rabbitmq",${selector}})`, 4, 'short'),
  stat('Messages ready', `sum(rabbitmq_queue_messages_ready{job="rabbitmq-queues",${queueSelector}})`, 8, 'short'),
  stat('Messages unacked', `sum(rabbitmq_queue_messages_unacked{job="rabbitmq-queues",${queueSelector}})`, 12, 'short'),
  stat('Consumers', `sum(rabbitmq_queue_consumers{job="rabbitmq-queues",${queueSelector}})`, 16, 'short'),
  stat('Active alarms', `sum(rabbitmq_alarms_file_descriptor_limit{job="rabbitmq",${selector}} + rabbitmq_alarms_free_disk_space_watermark{job="rabbitmq",${selector}} + rabbitmq_alarms_memory_used_watermark{job="rabbitmq",${selector}})`, 20, 'short'),

  timeseries('Message flow', [
    target(`sum(rate(rabbitmq_global_messages_received_total{job="rabbitmq",${selector}}[$__rate_interval]))`, 'A', 'Published'),
    target(`sum(rate(rabbitmq_global_messages_delivered_total{job="rabbitmq",${selector}}[$__rate_interval]))`, 'B', 'Delivered'),
    target(`sum(rate(rabbitmq_global_messages_acknowledged_total{job="rabbitmq",${selector}}[$__rate_interval]))`, 'C', 'Acknowledged'),
  ], 0, 4),
  timeseries('Ready and unacked messages', [
    target(`sum(rabbitmq_queue_messages_ready{job="rabbitmq-queues",${queueSelector}})`, 'A', 'Ready'),
    target(`sum(rabbitmq_queue_messages_unacked{job="rabbitmq-queues",${queueSelector}})`, 'B', 'Unacked'),
  ], 12, 4, 12, 'short'),

  timeseries('RabbitMQ memory by target', [
    target(`rabbitmq_process_resident_memory_bytes{job="rabbitmq",${selector}}`, 'A', '{{project}} / {{instance}}'),
  ], 0, 12, 12, 'bytes'),
  timeseries('Disk space available by target', [
    target(`rabbitmq_disk_space_available_bytes{job="rabbitmq",${selector}}`, 'A', '{{project}} / {{instance}}'),
  ], 12, 12, 12, 'bytes'),

  table('Top queues', [
    target(`topk(100, sum by (project,instance,vhost,queue) (rabbitmq_queue_messages_ready{job="rabbitmq-queues",${queueSelector}}))`, 'A'),
    target(`sum by (project,instance,vhost,queue) (rabbitmq_queue_messages_unacked{job="rabbitmq-queues",${queueSelector}})`, 'B'),
    target(`sum by (project,instance,vhost,queue) (rabbitmq_queue_consumers{job="rabbitmq-queues",${queueSelector}})`, 'C'),
  ], 0, 20, 24, 12, [
    { id: 'labelsToFields', options: { mode: 'columns' } },
    { id: 'merge', options: {} },
    { id: 'organize', options: {
      excludeByName: { Time: true },
      indexByName: { project: 0, instance: 1, vhost: 2, queue: 3, 'Value #A': 4, 'Value #B': 5, 'Value #C': 6 },
      renameByName: { project: 'Cluster', instance: 'Target', vhost: 'Vhost', queue: 'Queue', 'Value #A': 'Ready', 'Value #B': 'Unacked', 'Value #C': 'Consumers' },
    } },
  ]),

  table('_error queues with messages', [
    target(`sort_desc(sum by (project,instance,vhost,queue) (rabbitmq_queue_messages{job="rabbitmq-queues",${selector},vhost=~"$vhost",queue=~".*_error$"}) > 0)`, 'A'),
  ], 0, 32, 12, 9, [{ id: 'labelsToFields', options: { mode: 'columns' } }]),
  table('_skipped queues with messages', [
    target(`sort_desc(sum by (project,instance,vhost,queue) (rabbitmq_queue_messages{job="rabbitmq-queues",${selector},vhost=~"$vhost",queue=~".*_skipped$"}) > 0)`, 'A'),
  ], 12, 32, 12, 9, [{ id: 'labelsToFields', options: { mode: 'columns' } }]),
  table('Queues with messages and no consumers', [
    target(`sort_desc((sum by (project,instance,vhost,queue) (rabbitmq_queue_messages_ready{job="rabbitmq-queues",${queueSelector}}) > 0) and on(project,instance,vhost,queue) (sum by (project,instance,vhost,queue) (rabbitmq_queue_consumers{job="rabbitmq-queues",${queueSelector}}) == 0))`, 'A'),
  ], 0, 41, 24, 10, [{ id: 'labelsToFields', options: { mode: 'columns' } }]),
];

const dashboard = {
  annotations: { list: [{ builtIn: 1, datasource: { type: 'grafana', uid: '-- Grafana --' }, enable: true, hide: true, iconColor: 'rgba(0, 211, 255, 1)', name: 'Annotations & Alerts', type: 'dashboard' }] },
  description: 'Unified operational overview for RabbitMQ Core, DMZ, Test and future monitored clusters.',
  editable: true,
  fiscalYearStartMonth: 0,
  graphTooltip: 1,
  id: null,
  links: [],
  liveNow: false,
  panels,
  refresh: '30s',
  schemaVersion: 39,
  tags: ['rabbitmq', 'prometheus', 'fora'],
  templating: {
    list: [
      { name: 'project', label: 'Cluster', type: 'query', datasource, definition: 'label_values(up{job="rabbitmq"}, project)', query: { query: 'label_values(up{job="rabbitmq"}, project)', refId: 'PrometheusVariableQueryEditor-Project' }, includeAll: true, allValue: '.*', multi: true, refresh: 1, sort: 1, current: { selected: true, text: 'All', value: '$__all' } },
      { name: 'instance', label: 'Target', type: 'query', datasource, definition: 'label_values(up{job="rabbitmq",project=~"$project"}, instance)', query: { query: 'label_values(up{job="rabbitmq",project=~"$project"}, instance)', refId: 'PrometheusVariableQueryEditor-Instance' }, includeAll: true, allValue: '.*', multi: true, refresh: 1, sort: 1, current: { selected: true, text: 'All', value: '$__all' } },
      { name: 'vhost', label: 'Vhost', type: 'query', datasource, definition: 'label_values(rabbitmq_queue_messages{job="rabbitmq-queues",project=~"$project",instance=~"$instance"}, vhost)', query: { query: 'label_values(rabbitmq_queue_messages{job="rabbitmq-queues",project=~"$project",instance=~"$instance"}, vhost)', refId: 'PrometheusVariableQueryEditor-Vhost' }, includeAll: true, allValue: '.*', multi: true, refresh: 1, sort: 1, current: { selected: true, text: 'All', value: '$__all' } },
      { name: 'queue', label: 'Queue regex', type: 'textbox', query: '.*', current: { selected: true, text: '.*', value: '.*' } },
    ],
  },
  time: { from: 'now-6h', to: 'now' },
  timepicker: {},
  timezone: 'browser',
  title: 'RabbitMQ - All Clusters',
  uid: 'rabbitmq-all-clusters',
  version: 1,
  weekStart: '',
};

fs.writeFileSync(process.argv[2] || 'rabbitmq-all-clusters.json', `${JSON.stringify(dashboard, null, 2)}\n`);
