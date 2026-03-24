const { mockQuery } = require('./setup');

const { startCampaign, scheduleNextDrop, checkMailerEscalation } = require('../src/services/campaignService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Campaign Service', () => {
  describe('startCampaign', () => {
    it('should set campaign status and create first drop', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // update property
      mockQuery.mockResolvedValueOnce({ rows: [] }); // insert drop_queue

      const result = await startCampaign(1);

      expect(result.propertyId).toBe(1);
      expect(result.dropNumber).toBe(1);
      expect(result.nextDropDate).toBeDefined();

      // Verify property update
      const updateCall = mockQuery.mock.calls[0];
      expect(updateCall[0]).toMatch(/campaign_status = 'flyer_in_progress'/);

      // Verify drop_queue insert
      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[0]).toMatch(/INSERT INTO drop_queue/);
      expect(insertCall[1][0]).toBe(1); // property_id
    });
  });

  describe('scheduleNextDrop', () => {
    it('should schedule next drop based on campaign_schedule', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ days_after_previous: 14 }],
      }); // schedule lookup
      mockQuery.mockResolvedValueOnce({ rows: [] }); // update property

      const result = await scheduleNextDrop(1, 1);

      expect(result).not.toBeNull();
      expect(result.propertyId).toBe(1);
      expect(result.dropNumber).toBe(2);

      // Verify property was updated with next drop date
      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toMatch(/campaign_drops_completed/);
      expect(updateCall[1][0]).toBe(1); // completedDropNumber
    });

    it('should mark campaign complete when no more drops scheduled', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no schedule entry for drop 5
      mockQuery.mockResolvedValueOnce({ rows: [] }); // update property to flyer_complete

      const result = await scheduleNextDrop(1, 4);

      expect(result).toBeNull();
      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toMatch(/flyer_complete/);
    });

    it('should calculate correct next date', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ days_after_previous: 30 }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await scheduleNextDrop(1, 3);

      expect(result.dropNumber).toBe(4);
      // Verify the date is approximately 30 days from now
      const nextDate = new Date(result.nextDropDate);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);
      expect(nextDate.toISOString().split('T')[0]).toBe(expectedDate.toISOString().split('T')[0]);
    });
  });

  describe('checkMailerEscalation', () => {
    it('should return disabled message when MAILER_ENABLED is false', async () => {
      process.env.MAILER_ENABLED = 'false';

      const result = await checkMailerEscalation();

      expect(result.escalated).toBe(0);
      expect(result.message).toMatch(/disabled/i);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should escalate flyer_complete properties to mailers when enabled', async () => {
      process.env.MAILER_ENABLED = 'true';

      // Find eligible properties
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, mailer_drops_completed: 0, mailer_total_drops: 3 },
          { id: 2, mailer_drops_completed: 0, mailer_total_drops: 3 },
        ],
      });

      // For property 1:
      mockQuery.mockResolvedValueOnce({ rows: [{ days_after_previous: 7 }] }); // mailer schedule
      mockQuery.mockResolvedValueOnce({ rows: [{ default_template_id: 'tmpl_1', cost_per_piece_cents: 77, provider: 'lob' }] }); // mailer config
      mockQuery.mockResolvedValueOnce({ rows: [] }); // insert mailer_queue
      mockQuery.mockResolvedValueOnce({ rows: [] }); // update property status

      // For property 2:
      mockQuery.mockResolvedValueOnce({ rows: [{ days_after_previous: 7 }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ default_template_id: 'tmpl_1', cost_per_piece_cents: 77, provider: 'lob' }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await checkMailerEscalation();

      expect(result.escalated).toBe(2);
      expect(result.message).toMatch(/Escalated 2/);

      // Verify mailer_queue insert
      const mailerInsert = mockQuery.mock.calls[3];
      expect(mailerInsert[0]).toMatch(/INSERT INTO mailer_queue/);

      // Verify property status update
      const statusUpdate = mockQuery.mock.calls[4];
      expect(statusUpdate[0]).toMatch(/mailer_in_progress/);

      process.env.MAILER_ENABLED = 'false';
    });

    it('should skip properties that already completed all mailers', async () => {
      process.env.MAILER_ENABLED = 'true';

      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, mailer_drops_completed: 3, mailer_total_drops: 3 }, // already done
        ],
      });

      const result = await checkMailerEscalation();

      expect(result.escalated).toBe(0);
      // Should only have made 1 query (finding eligible properties)
      expect(mockQuery).toHaveBeenCalledTimes(1);

      process.env.MAILER_ENABLED = 'false';
    });
  });
});
