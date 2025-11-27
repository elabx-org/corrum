import Database from 'better-sqlite3';
import type { StorageBackend, ProposalFilter, StorageStats } from './interface.js';
import type { Proposal, CreateProposalInput, ProposalStatus } from '../types/proposal.js';
import type { Review, AddReviewInput } from '../types/review.js';
import type { Decision, AgentName } from '../types/index.js';

export class SqliteStorage implements StorageBackend {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        planner TEXT NOT NULL,
        reviewers TEXT NOT NULL,
        arbiter TEXT,
        iterations INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        file_path TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL,
        agent TEXT NOT NULL,
        vote TEXT NOT NULL,
        content TEXT NOT NULL,
        severity_critical INTEGER DEFAULT 0,
        severity_high INTEGER DEFAULT 0,
        severity_medium INTEGER DEFAULT 0,
        severity_low INTEGER DEFAULT 0,
        recorded_at TEXT NOT NULL,
        file_path TEXT NOT NULL,
        FOREIGN KEY (proposal_id) REFERENCES proposals(id)
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL UNIQUE,
        outcome TEXT NOT NULL,
        summary TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        file_path TEXT NOT NULL,
        FOREIGN KEY (proposal_id) REFERENCES proposals(id)
      );

      CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
      CREATE INDEX IF NOT EXISTS idx_proposals_planner ON proposals(planner);
      CREATE INDEX IF NOT EXISTS idx_reviews_proposal ON reviews(proposal_id);
    `);
  }

  createProposal(input: CreateProposalInput & { id: string; filePath: string; status: ProposalStatus; planner: AgentName; reviewers: AgentName[] }): Proposal {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO proposals (id, title, content, status, planner, reviewers, iterations, created_at, updated_at, file_path)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `);
    stmt.run(input.id, input.title, input.content, input.status, input.planner, JSON.stringify(input.reviewers), now, now, input.filePath);
    return this.getProposal(input.id)!;
  }

  getProposal(id: string): Proposal | null {
    const stmt = this.db.prepare('SELECT * FROM proposals WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.rowToProposal(row);
  }

  updateProposal(id: string, updates: Partial<Proposal>): Proposal | null {
    const existing = this.getProposal(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
    if (updates.arbiter !== undefined) { fields.push('arbiter = ?'); values.push(updates.arbiter); }
    if (updates.iterations !== undefined) { fields.push('iterations = ?'); values.push(updates.iterations); }
    if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = this.db.prepare(`UPDATE proposals SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getProposal(id);
  }

  listProposals(filter?: ProposalFilter): Proposal[] {
    let sql = 'SELECT * FROM proposals WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      sql += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }
    if (filter?.planner) {
      sql += ' AND planner = ?';
      params.push(filter.planner);
    }
    if (filter?.since) {
      sql += ' AND created_at >= ?';
      params.push(filter.since.toISOString());
    }
    if (filter?.notImplemented) {
      sql += ' AND status = ? AND completed_at IS NULL';
      params.push('approved');
    }

    sql += ' ORDER BY created_at DESC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.rowToProposal(row));
  }

  addReview(input: AddReviewInput & { id: string; filePath: string }): Review {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO reviews (id, proposal_id, agent, vote, content, severity_critical, severity_high, severity_medium, severity_low, recorded_at, file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      input.id,
      input.proposalId,
      input.agent,
      input.vote,
      input.content,
      input.severity?.critical ?? 0,
      input.severity?.high ?? 0,
      input.severity?.medium ?? 0,
      input.severity?.low ?? 0,
      now,
      input.filePath
    );
    return this.getReview(input.id)!;
  }

  private getReview(id: string): Review | null {
    const stmt = this.db.prepare('SELECT * FROM reviews WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.rowToReview(row);
  }

  getReviewsForProposal(proposalId: string): Review[] {
    const stmt = this.db.prepare('SELECT * FROM reviews WHERE proposal_id = ? ORDER BY recorded_at');
    const rows = stmt.all(proposalId) as any[];
    return rows.map(row => this.rowToReview(row));
  }

  recordDecision(decision: Decision): Decision {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO decisions (id, proposal_id, outcome, summary, recorded_at, file_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(decision.id, decision.proposalId, decision.outcome, decision.summary, decision.recordedAt, decision.filePath);
    return decision;
  }

  getDecision(proposalId: string): Decision | null {
    const stmt = this.db.prepare('SELECT * FROM decisions WHERE proposal_id = ?');
    const row = stmt.get(proposalId) as any;
    if (!row) return null;
    return {
      id: row.id,
      proposalId: row.proposal_id,
      outcome: row.outcome,
      summary: row.summary,
      recordedAt: row.recorded_at,
      filePath: row.file_path
    };
  }

  getStats(since?: Date): StorageStats {
    const sinceClause = since ? 'WHERE created_at >= ?' : '';
    const sinceParam = since ? [since.toISOString()] : [];

    // Total proposals and by status
    const proposalStats = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM proposals ${sinceClause} GROUP BY status
    `).all(...sinceParam) as { status: string; count: number }[];

    const byStatus: Record<string, number> = {};
    let totalProposals = 0;
    for (const row of proposalStats) {
      byStatus[row.status] = row.count;
      totalProposals += row.count;
    }

    // Total reviews
    const reviewCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM reviews r
      ${since ? 'JOIN proposals p ON r.proposal_id = p.id WHERE p.created_at >= ?' : ''}
    `).get(...sinceParam) as { count: number };

    // Arbiter invocations (proposals with arbiter set)
    const arbiterCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM proposals WHERE arbiter IS NOT NULL ${since ? 'AND created_at >= ?' : ''}
    `).get(...sinceParam) as { count: number };

    // Severity stats
    const severityStats = this.db.prepare(`
      SELECT
        SUM(severity_critical) as critical,
        SUM(severity_high) as high,
        SUM(severity_medium) as medium,
        SUM(severity_low) as low
      FROM reviews r
      ${since ? 'JOIN proposals p ON r.proposal_id = p.id WHERE p.created_at >= ?' : ''}
    `).get(...sinceParam) as any;

    // Agent stats
    const plannerStats = this.db.prepare(`
      SELECT planner as agent, COUNT(*) as count FROM proposals ${sinceClause} GROUP BY planner
    `).all(...sinceParam) as { agent: string; count: number }[];

    const reviewerStats = this.db.prepare(`
      SELECT agent, COUNT(*) as count FROM reviews r
      ${since ? 'JOIN proposals p ON r.proposal_id = p.id WHERE p.created_at >= ?' : ''}
      GROUP BY agent
    `).all(...sinceParam) as { agent: string; count: number }[];

    const arbiterStats = this.db.prepare(`
      SELECT arbiter as agent, COUNT(*) as count FROM proposals WHERE arbiter IS NOT NULL ${since ? 'AND created_at >= ?' : ''} GROUP BY arbiter
    `).all(...sinceParam) as { agent: string; count: number }[];

    const byAgent: Record<string, { proposals: number; reviews: number; arbitrations: number }> = {
      claude: { proposals: 0, reviews: 0, arbitrations: 0 },
      codex: { proposals: 0, reviews: 0, arbitrations: 0 },
      gemini: { proposals: 0, reviews: 0, arbitrations: 0 }
    };

    for (const row of plannerStats) {
      if (byAgent[row.agent]) byAgent[row.agent].proposals = row.count;
    }
    for (const row of reviewerStats) {
      if (byAgent[row.agent]) byAgent[row.agent].reviews = row.count;
    }
    for (const row of arbiterStats) {
      if (byAgent[row.agent]) byAgent[row.agent].arbitrations = row.count;
    }

    return {
      totalProposals,
      byStatus: byStatus as Record<ProposalStatus, number>,
      totalReviews: reviewCount.count,
      avgReviewsPerProposal: totalProposals > 0 ? reviewCount.count / totalProposals : 0,
      arbiterInvocations: arbiterCount.count,
      issuesBySeverity: {
        critical: severityStats?.critical ?? 0,
        high: severityStats?.high ?? 0,
        medium: severityStats?.medium ?? 0,
        low: severityStats?.low ?? 0
      },
      byAgent: byAgent as Record<AgentName, { proposals: number; reviews: number; arbitrations: number }>
    };
  }

  close(): void {
    this.db.close();
  }

  private rowToProposal(row: any): Proposal {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      status: row.status as ProposalStatus,
      planner: row.planner as AgentName,
      reviewers: JSON.parse(row.reviewers) as AgentName[],
      arbiter: row.arbiter as AgentName | undefined,
      iterations: row.iterations,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at ?? undefined,
      filePath: row.file_path
    };
  }

  private rowToReview(row: any): Review {
    return {
      id: row.id,
      proposalId: row.proposal_id,
      agent: row.agent as AgentName,
      vote: row.vote as Review['vote'],
      content: row.content,
      severity: {
        critical: row.severity_critical,
        high: row.severity_high,
        medium: row.severity_medium,
        low: row.severity_low
      },
      recordedAt: row.recorded_at,
      filePath: row.file_path
    };
  }
}
