# RabbitMQ Grafana Dashboard Design

## Goal

Create one operational Grafana dashboard for all RabbitMQ clusters known to the monitoring system. It must show cluster health, aggregate message counts, traffic trends, and queue-level problems such as `_error`, `_skipped`, and queues without consumers.

## Data Source

Use the existing Prometheus data source on `monit-fora.fozzy.lan`. RabbitMQ metrics are collected from the native `rabbitmq_prometheus` endpoint. Queue-level panels use `/metrics/per-object` series with `vhost` and `queue` labels.

The dashboard initially includes clusters that expose metrics:

- `rabbitmq.fora.fozzy.lan`
- `rabbitmq.fora-dmzaws.fozzy.lan`
- `rabbitmq.ecomfora.test.fozzy.lan` through `10.10.65.61:15692`

Additional RabbitMQ clusters will appear automatically after their Prometheus targets expose compatible labels. Unavailable clusters may be represented as `No data` until their targets are configured.

## Layout

The dashboard uses a single operational layout with these variables:

- `cluster` from the Prometheus `project` label;
- `instance` for an individual exporter target;
- `vhost`;
- `queue`, supporting text filtering.

Panels are arranged in this order:

1. Availability and summary: target health, nodes, queues, ready messages, unacknowledged messages, and consumers.
2. Traffic: publish, deliver, and acknowledgement rates over time.
3. Resource health: memory, disk, file descriptor alarms, and cluster partitions where metrics are available.
4. Queue diagnostics: sortable table with queue, vhost, ready, unacknowledged, consumers, and message rate.
5. Problem queues: `_error`, `_skipped`, queues with messages but no consumers, and fastest-growing queues.

## Persistence

Store the dashboard in the existing Grafana database through the Grafana API. Save a JSON backup on `monit-fora.fozzy.lan` before and after installation. Add the test RabbitMQ target to the existing file-based Prometheus target configuration and validate the Prometheus configuration before reload.

## Validation

- Prometheus configuration validation succeeds.
- The new test RabbitMQ target reports `up == 1`.
- Dashboard queries return data for Core, DMZ, and Test.
- Queue table exposes `vhost` and `queue` labels.
- Existing Grafana dashboards and Prometheus targets remain unchanged.
