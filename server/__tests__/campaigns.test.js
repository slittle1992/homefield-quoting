const { mockQuery, mockConnect, mockClient } = require('./setup');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/index');

function adminToken() {
  return jwt.sign(
    { id: 1, email: 'admin@pooldrop.com', name: 'Admin', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(mockClient);
});

describe('Campaigns Routes', () => {
  describe('GET /api/campaigns/schedule', () => {
    it('should return campaign and mailer schedules', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { drop_number: 1, days_after_previous: 0 },
          { drop_number: 2, days_after_previous: 14 },
          { drop_number: 3, days_after_previous: 16 },
          { drop_number: 4, days_after_previous: 30 },
        ],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { mailer_number: 1, days_after_previous: 7 },
          { mailer_number: 2, days_after_previous: 21 },
          { mailer_number: 3, days_after_previous: 21 },
        ],
      });

      const res = await request(app)
        .get('/api/campaigns/schedule')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.campaign_schedule).toHaveLength(4);
      expect(res.body.mailer_schedule).toHaveLength(3);
      expect(res.body.campaign_schedule[1].days_after_previous).toBe(14);
    });
  });

  describe('PUT /api/campaigns/schedule', () => {
    it('should update campaign schedule', async () => {
      mockClient.query.mockResolvedValue({ rows: [] }); // BEGIN, upserts, COMMIT
      mockQuery.mockResolvedValueOnce({
        rows: [
          { drop_number: 1, days_after_previous: 0 },
          { drop_number: 2, days_after_previous: 10 },
        ],
      });

      const res = await request(app)
        .put('/api/campaigns/schedule')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          schedule: [
            { drop_number: 1, days_after_previous: 0 },
            { drop_number: 2, days_after_previous: 10 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.campaign_schedule).toBeDefined();
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .put('/api/campaigns/schedule')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ schedule: 'not-an-array' });

      expect(res.status).toBe(400);
    });

    it('should require admin role', async () => {
      const driverTkn = jwt.sign(
        { id: 10, email: 'driver@test.com', role: 'driver' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      const res = await request(app)
        .put('/api/campaigns/schedule')
        .set('Authorization', `Bearer ${driverTkn}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/campaigns/mailer-schedule', () => {
    it('should update mailer schedule', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { mailer_number: 1, days_after_previous: 7 },
          { mailer_number: 2, days_after_previous: 14 },
        ],
      });

      const res = await request(app)
        .put('/api/campaigns/mailer-schedule')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          schedule: [
            { mailer_number: 1, days_after_previous: 7 },
            { mailer_number: 2, days_after_previous: 14 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.mailer_schedule).toBeDefined();
    });
  });

  describe('GET /api/campaigns/pipeline', () => {
    it('should return pipeline counts for all stages', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { campaign_status: 'not_started', count: 50 },
          { campaign_status: 'flyer_in_progress', count: 30 },
          { campaign_status: 'flyer_complete', count: 10 },
        ],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { campaign_drops_completed: 1, count: 15 },
          { campaign_drops_completed: 2, count: 10 },
          { campaign_drops_completed: 3, count: 5 },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] }); // mailer in progress
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] }); // mailer complete
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] }); // fb exported
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 8 }] }); // converted
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] }); // archived

      const res = await request(app)
        .get('/api/campaigns/pipeline')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      const pipeline = res.body.pipeline;
      expect(pipeline.not_started).toBe(50);
      expect(pipeline.flyer_in_progress.total).toBe(30);
      expect(pipeline.flyer_in_progress.by_drop).toHaveLength(3);
      expect(pipeline.flyer_complete).toBe(10);
      expect(pipeline.mailer_in_progress).toBe(3);
      expect(pipeline.mailer_complete).toBe(2);
      expect(pipeline.fb_exported).toBe(5);
      expect(pipeline.converted).toBe(8);
      expect(pipeline.archived).toBe(1);
    });
  });
});
