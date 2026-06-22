# RabbitMQ Grafana Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Test RabbitMQ metrics endpoint to Prometheus and install one Grafana dashboard for all monitored RabbitMQ clusters.

**Architecture:** Prometheus scrapes RabbitMQ native metrics and per-object metrics from file-based target definitions. Grafana queries the existing Prometheus data source and uses `project`, `instance`, `vhost`, and `queue` labels as dashboard variables.

**Tech Stack:** Prometheus, RabbitMQ Prometheus plugin, Grafana, Kubernetes, JSON dashboard model

---

### Task 1: Add the Test RabbitMQ target

**Files:**
- Modify on `monit-fora.fozzy.lan`: existing RabbitMQ target file under `/etc/prometheus/targets/rabbitmq/`
- Backup on `monit-fora.fozzy.lan`: timestamped copy of the modified target file

- [ ] **Step 1: Inspect current RabbitMQ scrape configuration**

Run `promtool check config /etc/prometheus/prometheus.yml` and locate the file-SD group used by job `rabbitmq`.

- [ ] **Step 2: Record the failing target query**

Run the Prometheus query `up{job="rabbitmq",project="rabbitmq-test"}` and confirm that it returns no series.

- [ ] **Step 3: Add Test target**

Add this target group using the existing file format:

```yaml
- targets:
    - 10.10.65.61:15692
  labels:
    env: test
    project: rabbitmq-test
```

- [ ] **Step 4: Validate and reload Prometheus**

Run `promtool check config /etc/prometheus/prometheus.yml`, reload Prometheus through its existing reload mechanism, and verify `up{job="rabbitmq",project="rabbitmq-test"} == 1`.

- [ ] **Step 5: Verify queue-level labels**

Query per-object queue metrics and confirm that `queue` and `vhost` labels are present for `project="rabbitmq-test"`.

### Task 2: Build the unified Grafana dashboard

**Files:**
- Create locally: `/tmp/rabbitmq-all-clusters.json`
- Backup on `monit-fora.fozzy.lan`: timestamped Grafana dashboard JSON

- [ ] **Step 1: Discover the Prometheus data-source UID**

Read it from the Grafana API and use the UID in every panel target.

- [ ] **Step 2: Generate the dashboard JSON**

Create dashboard `RabbitMQ - All Clusters` with variables `project`, `instance`, `vhost`, and `queue`. Include stat panels for exporter health, queues, ready, unacknowledged, and consumers; time-series panels for message rates and resource alarms; and queue tables for all queues, `_error`, `_skipped`, and queues without consumers.

- [ ] **Step 3: Validate dashboard JSON**

Parse it with `jq empty /tmp/rabbitmq-all-clusters.json` and verify that all PromQL expressions contain the selected dashboard variables.

- [ ] **Step 4: Install through the Grafana API**

Create or update the dashboard with overwrite enabled. Record its returned UID and URL.

### Task 3: End-to-end verification

**Files:**
- Read: installed Grafana dashboard JSON
- Read: Prometheus query API responses

- [ ] **Step 1: Verify all active RabbitMQ projects**

Confirm that Prometheus returns `up == 1` for `rabbitmq-core`, `rabbitmq-DMZ`, and `rabbitmq-test`.

- [ ] **Step 2: Verify dashboard queries**

Execute representative queries for ready, unacknowledged, consumers, `_error`, `_skipped`, and no-consumer queues through the Prometheus API. Each query must succeed without a parse error.

- [ ] **Step 3: Verify the Grafana dashboard**

Fetch the dashboard by UID from Grafana, confirm its title and panel count, and open the returned URL to ensure Grafana serves it.

- [ ] **Step 4: Report unavailable clusters separately**

Document that `rabbitmq.ecomfora.test.dmz.fozzy.lan` and `rabbitmq-dmz.fora.fozzy.lan` cannot appear with queue metrics until their `15692` endpoints are exposed and added to Prometheus.
