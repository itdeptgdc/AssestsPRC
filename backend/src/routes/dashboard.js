const express = require('express');
const { query } = require('../db');

const r = express.Router();
const PERIODS = { week: 'week', month: 'month', quarter: 'quarter', year: 'year' };

r.get('/', async (req, res) => {
  const period = PERIODS[req.query.period] || 'month';
  const { rows: s } = await query(`SELECT value FROM settings WHERE key='due_soon_days'`);
  const days = Number(s[0]?.value) || 30;

  const [totals, byStatus, byCategory, repairCost, trend, upcoming, openRepairs, activity, byDept] = await Promise.all([
    query(`SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE status='active') AS active,
                  COUNT(*) FILTER (WHERE status NOT IN ('disposed','lost') AND next_inspection < CURRENT_DATE) AS overdue,
                  COUNT(*) FILTER (WHERE status NOT IN ('disposed','lost') AND next_inspection BETWEEN CURRENT_DATE AND CURRENT_DATE + ${days}) AS due_soon,
                  COUNT(*) FILTER (WHERE status IN ('repair','broken')) AS repair,
                  COALESCE(SUM(cost) FILTER (WHERE status <> 'disposed'),0) AS total_value
             FROM assets`),
    query(`SELECT status, COUNT(*) AS count FROM assets GROUP BY status ORDER BY count DESC`),
    query(`SELECT c.id, c.code, c.account_code, c.name, c.color, COUNT(a.id) AS count
             FROM asset_codes c JOIN assets a ON a.category_id=c.id
            GROUP BY c.id ORDER BY count DESC LIMIT 8`),
    query(`SELECT COALESCE(SUM(cost),0) AS total, COUNT(*) AS count, COALESCE(AVG(NULLIF(cost,0)),0) AS avg
             FROM repairs WHERE reported_at >= date_trunc('${period}', CURRENT_DATE) AND status <> 'cancelled'`),
    query(`WITH m AS (
             SELECT generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '5 months', date_trunc('month', CURRENT_DATE), INTERVAL '1 month')::date AS month
           )
           SELECT to_char(m.month,'YYYY-MM') AS month,
                  (SELECT COUNT(*) FROM assets a WHERE date_trunc('month', a.created_at)::date = m.month) AS assets,
                  (SELECT COUNT(*) FROM inspections i WHERE date_trunc('month', i.inspected_at)::date = m.month) AS inspections,
                  (SELECT COALESCE(SUM(cost),0) FROM repairs rp WHERE date_trunc('month', rp.reported_at)::date = m.month AND rp.status <> 'cancelled') AS repair_cost
             FROM m ORDER BY m.month`),
    query(`SELECT a.id, a.code, a.name, a.next_inspection, (a.next_inspection - CURRENT_DATE) AS days_left, l.name AS location_name
             FROM assets a LEFT JOIN locations l ON l.id=a.location_id
            WHERE a.status NOT IN ('disposed','lost') AND a.next_inspection <= CURRENT_DATE + ${days}
            ORDER BY a.next_inspection ASC LIMIT 6`),
    query(`SELECT rp.id, rp.ticket_no, rp.problem, rp.status, rp.priority, rp.reported_at, a.id AS asset_id, a.code AS asset_code, a.name AS asset_name
             FROM repairs rp JOIN assets a ON a.id=rp.asset_id
            WHERE rp.status IN ('open','in_progress','waiting_parts')
            ORDER BY CASE rp.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, rp.reported_at DESC LIMIT 6`),
    query(`SELECT al.*, u.name AS user_name FROM activity_logs al LEFT JOIN users u ON u.id=al.user_id
            ORDER BY al.created_at DESC LIMIT 8`),
    query(`SELECT d.code, d.name, COUNT(a.id) AS count FROM department_codes d JOIN assets a ON a.department_id=d.id
             GROUP BY d.id ORDER BY count DESC LIMIT 6`),
  ]);

  res.json({
    totals: totals.rows[0],
    byStatus: byStatus.rows,
    byCategory: byCategory.rows,
    byDepartment: byDept.rows,
    repairCost: repairCost.rows[0],
    trend: trend.rows,
    upcoming: upcoming.rows,
    openRepairs: openRepairs.rows,
    activity: activity.rows,
    period,
  });
});

module.exports = r;
