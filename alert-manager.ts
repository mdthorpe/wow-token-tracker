import { Database } from 'bun:sqlite';

type AlertDirection = 'above' | 'below';

interface PriceAlert {
  id: string;
  userId: string;
  channelId: string;
  region: string;
  threshold: number;
  direction: AlertDirection;
  createdAt: Date;
  triggered: boolean;
}

class AlertManager {
  private db: Database;
  private alertCounter = 0;

  constructor(dbPath: string = 'alerts.db') {
    this.db = new Database(dbPath);
    this.initDatabase();
    this.loadAlertCounter();
  }

  private initDatabase(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        region TEXT NOT NULL,
        threshold INTEGER NOT NULL,
        direction TEXT NOT NULL DEFAULT 'above',
        created_at INTEGER NOT NULL,
        triggered INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Create index for faster queries
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_user_id ON alerts(user_id)
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_triggered ON alerts(triggered)
    `);

    // Migrate existing alerts to have direction if column doesn't exist
    try {
      this.db.run(`ALTER TABLE alerts ADD COLUMN direction TEXT NOT NULL DEFAULT 'above'`);
    } catch (e) {
      // Column already exists, ignore
    }
  }

  private loadAlertCounter(): void {
    // Get the highest counter value from existing alert IDs
    const result = this.db
      .query<{ id: string }, []>('SELECT id FROM alerts ORDER BY id DESC LIMIT 1')
      .get();

    if (result?.id) {
      const match = result.id.match(/-(\d+)$/);
      if (match && match[1]) {
        this.alertCounter = parseInt(match[1], 10);
      }
    }
  }

  addAlert(
    userId: string,
    channelId: string,
    region: string,
    threshold: number,
    direction: AlertDirection = 'above'
  ): PriceAlert {
    const id = `${userId}-${++this.alertCounter}`;
    const createdAt = new Date();

    this.db.run(
      `INSERT INTO alerts (id, user_id, channel_id, region, threshold, direction, created_at, triggered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, channelId, region, threshold, direction, createdAt.getTime(), 0]
    );

    return {
      id,
      userId,
      channelId,
      region,
      threshold,
      direction,
      createdAt,
      triggered: false,
    };
  }

  getUserAlerts(userId: string): PriceAlert[] {
    const rows = this.db
      .query<
        {
          id: string;
          user_id: string;
          channel_id: string;
          region: string;
          threshold: number;
          direction: string;
          created_at: number;
          triggered: number;
        },
        [string]
      >('SELECT * FROM alerts WHERE user_id = ? AND triggered = 0')
      .all(userId);

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      channelId: row.channel_id,
      region: row.region,
      threshold: row.threshold,
      direction: row.direction as AlertDirection,
      createdAt: new Date(row.created_at),
      triggered: row.triggered === 1,
    }));
  }

  getAllActiveAlerts(): PriceAlert[] {
    const rows = this.db
      .query<
        {
          id: string;
          user_id: string;
          channel_id: string;
          region: string;
          threshold: number;
          direction: string;
          created_at: number;
          triggered: number;
        },
        []
      >('SELECT * FROM alerts WHERE triggered = 0')
      .all();

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      channelId: row.channel_id,
      region: row.region,
      threshold: row.threshold,
      direction: row.direction as AlertDirection,
      createdAt: new Date(row.created_at),
      triggered: row.triggered === 1,
    }));
  }

  removeAlert(userId: string, alertId: string): boolean {
    const result = this.db.run(
      'DELETE FROM alerts WHERE id = ? AND user_id = ?',
      [alertId, userId]
    );

    return result.changes > 0;
  }

  markAsTriggered(alertId: string): void {
    this.db.run('UPDATE alerts SET triggered = 1 WHERE id = ?', [alertId]);
  }

  getAlertById(alertId: string): PriceAlert | undefined {
    const row = this.db
      .query<
        {
          id: string;
          user_id: string;
          channel_id: string;
          region: string;
          threshold: number;
          direction: string;
          created_at: number;
          triggered: number;
        },
        [string]
      >('SELECT * FROM alerts WHERE id = ?')
      .get(alertId);

    if (!row) return undefined;

    return {
      id: row.id,
      userId: row.user_id,
      channelId: row.channel_id,
      region: row.region,
      threshold: row.threshold,
      direction: row.direction as AlertDirection,
      createdAt: new Date(row.created_at),
      triggered: row.triggered === 1,
    };
  }

  close(): void {
    this.db.close();
  }
}

export const alertManager = new AlertManager();
export type { PriceAlert, AlertDirection };

