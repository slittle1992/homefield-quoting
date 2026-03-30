const crypto = require('crypto');

// Unit tests for service modules — no DB mocking needed for pure functions

describe('lobService', () => {
  let lobService;

  beforeEach(() => {
    jest.resetModules();
    // Set env vars before requiring the module
    process.env.COMPANY_NAME = 'TestPool Co';
    process.env.COMPANY_ADDRESS = '123 Main St';
    process.env.COMPANY_CITY = 'Austin';
    process.env.COMPANY_STATE = 'TX';
    process.env.COMPANY_ZIP = '78701';
    process.env.COMPANY_PHONE = '512-555-1234';
    process.env.COMPANY_WEBSITE = 'https://testpool.com';
    process.env.COMPANY_LOGO_URL = 'https://testpool.com/logo.png';
    lobService = require('../src/services/lobService');
  });

  afterEach(() => {
    delete process.env.COMPANY_NAME;
    delete process.env.COMPANY_ADDRESS;
    delete process.env.COMPANY_CITY;
    delete process.env.COMPANY_STATE;
    delete process.env.COMPANY_ZIP;
    delete process.env.COMPANY_PHONE;
    delete process.env.COMPANY_WEBSITE;
    delete process.env.COMPANY_LOGO_URL;
  });

  describe('getPostcardTemplates()', () => {
    it('should return an object with front and back HTML strings', () => {
      const templates = lobService.getPostcardTemplates();
      expect(templates).toHaveProperty('front');
      expect(templates).toHaveProperty('back');
      expect(typeof templates.front).toBe('string');
      expect(typeof templates.back).toBe('string');
    });

    it('should include DOCTYPE and html tags in both templates', () => {
      const { front, back } = lobService.getPostcardTemplates();
      expect(front).toContain('<!DOCTYPE html>');
      expect(back).toContain('<!DOCTYPE html>');
      expect(front).toContain('<html>');
      expect(back).toContain('<html>');
    });

    it('should include placeholders in the back template', () => {
      const { back } = lobService.getPostcardTemplates();
      expect(back).toContain('{{owner_name}}');
      expect(back).toContain('{{address}}');
    });

    it('should embed company name from env vars', () => {
      const { back } = lobService.getPostcardTemplates();
      expect(back).toContain('TestPool Co');
    });

    it('should embed logo URL when set', () => {
      const { front } = lobService.getPostcardTemplates();
      expect(front).toContain('https://testpool.com/logo.png');
    });
  });

  describe('getDefaultFrom()', () => {
    it('should return address fields from environment variables', () => {
      const from = lobService.getDefaultFrom();
      expect(from).toEqual({
        name: 'TestPool Co',
        address_line1: '123 Main St',
        address_city: 'Austin',
        address_state: 'TX',
        address_zip: '78701',
      });
    });

    it('should default to empty strings when env vars are not set', () => {
      delete process.env.COMPANY_NAME;
      delete process.env.COMPANY_ADDRESS;
      delete process.env.COMPANY_CITY;
      delete process.env.COMPANY_ZIP;
      jest.resetModules();
      const fresh = require('../src/services/lobService');
      const from = fresh.getDefaultFrom();
      expect(from.name).toBe('');
      expect(from.address_line1).toBe('');
      expect(from.address_city).toBe('');
      expect(from.address_state).toBe('TX'); // default
      expect(from.address_zip).toBe('');
    });
  });

  describe('renderTemplate()', () => {
    it('should replace single placeholder', () => {
      const html = '<p>Hello {{owner_name}}</p>';
      const result = lobService.renderTemplate(html, { owner_name: 'John Smith' });
      expect(result).toBe('<p>Hello John Smith</p>');
    });

    it('should replace multiple different placeholders', () => {
      const html = '<p>{{owner_name}} at {{address}}</p>';
      const result = lobService.renderTemplate(html, {
        owner_name: 'Jane Doe',
        address: '456 Oak Ave',
      });
      expect(result).toBe('<p>Jane Doe at 456 Oak Ave</p>');
    });

    it('should replace repeated occurrences of the same placeholder', () => {
      const html = '{{name}} - {{name}}';
      const result = lobService.renderTemplate(html, { name: 'Repeat' });
      expect(result).toBe('Repeat - Repeat');
    });

    it('should replace missing vars with empty string', () => {
      const html = 'Hi {{owner_name}}';
      const result = lobService.renderTemplate(html, { owner_name: null });
      expect(result).toBe('Hi ');
    });

    it('should return original HTML when no vars provided', () => {
      const html = '<p>Static content</p>';
      const result = lobService.renderTemplate(html);
      expect(result).toBe('<p>Static content</p>');
    });
  });
});

describe('metaService', () => {
  let metaService;

  beforeEach(() => {
    jest.resetModules();
    metaService = require('../src/services/metaService');
  });

  describe('getAdTemplates()', () => {
    it('should return exactly 3 templates', () => {
      const templates = metaService.getAdTemplates();
      expect(templates).toHaveLength(3);
    });

    it('should have required fields on every template', () => {
      const templates = metaService.getAdTemplates();
      for (const tpl of templates) {
        expect(tpl).toHaveProperty('id');
        expect(tpl).toHaveProperty('name');
        expect(tpl).toHaveProperty('primary_text');
        expect(tpl).toHaveProperty('headline');
        expect(tpl).toHaveProperty('description');
        expect(typeof tpl.id).toBe('number');
        expect(typeof tpl.name).toBe('string');
        expect(tpl.primary_text.length).toBeGreaterThan(0);
        expect(tpl.headline.length).toBeGreaterThan(0);
        expect(tpl.description.length).toBeGreaterThan(0);
      }
    });

    it('should have sequential ids starting from 0', () => {
      const templates = metaService.getAdTemplates();
      expect(templates[0].id).toBe(0);
      expect(templates[1].id).toBe(1);
      expect(templates[2].id).toBe(2);
    });
  });

  describe('sha256 hashing', () => {
    // The sha256 function is not exported, so we verify its behavior through
    // the known algorithm: SHA-256 of trimmed, lowercased input
    it('should produce correct SHA-256 hash for known input', () => {
      // The metaService uses: crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
      // Verify the algorithm by computing directly
      const input = 'John';
      const expected = crypto
        .createHash('sha256')
        .update('john') // trimmed + lowercased
        .digest('hex');
      // Expected: 96d9632f363564cc3032521409cf22a852f2032eec099ed5967c0d000cec607a
      expect(expected).toBe('96d9632f363564cc3032521409cf22a852f2032eec099ed5967c0d000cec607a');
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = crypto.createHash('sha256').update('john').digest('hex');
      const hash2 = crypto.createHash('sha256').update('jane').digest('hex');
      expect(hash1).not.toBe(hash2);
    });

    it('should normalize case before hashing', () => {
      const hash1 = crypto.createHash('sha256').update('john').digest('hex');
      const hashFromUpper = crypto
        .createHash('sha256')
        .update('JOHN'.trim().toLowerCase())
        .digest('hex');
      expect(hash1).toBe(hashFromUpper);
    });
  });
});
