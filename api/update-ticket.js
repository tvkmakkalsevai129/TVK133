// /api/update-ticket.js
// Vercel Serverless Function to update complaint status, officer, and timeline notes
// Uses SUPABASE_SERVICE_ROLE_KEY to bypass client-side RLS restrictions securely

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, id, ids, status, officer, note, updated_by } = req.body;

    const supabaseUrl = process.env.SUPABASE_URL || 'https://vtfuhajbqbrotjsufnrj.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZnVoYWpicWJyb3Rqc3VmbnJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzIzOTEzOSwiZXhwIjoyMTA4ODE1MTM5fQ.vf0kuOmewG3sda9rR_m2H2ZAdcJqMy0YdXA230AdxoQ';

    const headers = {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // 1. Single Status Update
    if (action === 'update_status') {
      if (!id || !status) return res.status(400).json({ error: 'Missing id or status' });

      const patchBody = { status };
      if (status === 'Resolved') {
        patchBody.resolved_at = new Date().toISOString();
      }

      const updateRes = await fetch(`${supabaseUrl}/rest/v1/complaints?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patchBody)
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        return res.status(updateRes.status).json({ error: errText });
      }

      // Add timeline entry
      await fetch(`${supabaseUrl}/rest/v1/ticket_updates`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          complaint_id: id,
          title: `Status Updated → ${status}`,
          description: `Status changed to "${status}" by ${updated_by || 'Staff'}`,
          updated_by: updated_by || 'Staff'
        })
      });

      return res.status(200).json({ success: true, status });
    }

    // 2. Bulk Status Update
    if (action === 'bulk_update_status') {
      if (!ids || !Array.isArray(ids) || !status) {
        return res.status(400).json({ error: 'Missing ids array or status' });
      }

      const patchBody = { status };
      if (status === 'Resolved') patchBody.resolved_at = new Date().toISOString();

      const inClause = `in.(${ids.join(',')})`;
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/complaints?id=${inClause}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patchBody)
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        return res.status(updateRes.status).json({ error: errText });
      }

      // Add timeline updates
      const timelineEntries = ids.map(cid => ({
        complaint_id: cid,
        title: `Bulk Status Update → ${status}`,
        description: `Bulk status update to "${status}" by ${updated_by || 'Staff'}`,
        updated_by: updated_by || 'Staff'
      }));

      await fetch(`${supabaseUrl}/rest/v1/ticket_updates`, {
        method: 'POST',
        headers,
        body: JSON.stringify(timelineEntries)
      });

      return res.status(200).json({ success: true, count: ids.length });
    }

    // 3. Assign Officer
    if (action === 'assign_officer') {
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const updateRes = await fetch(`${supabaseUrl}/rest/v1/complaints?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ assigned_officer: officer || null })
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        return res.status(updateRes.status).json({ error: errText });
      }

      await fetch(`${supabaseUrl}/rest/v1/ticket_updates`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          complaint_id: id,
          title: 'Officer Assigned',
          description: `Assigned to: ${officer || '(Unassigned)'}`,
          updated_by: updated_by || 'Staff'
        })
      });

      return res.status(200).json({ success: true, officer });
    }

    // 4. Add Staff Note
    if (action === 'add_note') {
      if (!id || !note) return res.status(400).json({ error: 'Missing id or note' });

      const noteRes = await fetch(`${supabaseUrl}/rest/v1/ticket_updates`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          complaint_id: id,
          title: 'Staff Note',
          description: note,
          updated_by: updated_by || 'Staff'
        })
      });

      if (!noteRes.ok) {
        const errText = await noteRes.text();
        return res.status(noteRes.status).json({ error: errText });
      }

      return res.status(200).json({ success: true, note });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
