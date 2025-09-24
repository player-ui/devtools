import { describe, beforeEach, expect, afterEach, it, vi } from "vitest";
import { Fancy } from '../index';

describe('Fancy', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock console.log to test logging behavior
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.log after each test
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create a Fancy instance with the given name', () => {
      const fancy = new Fancy('test-name');
      
      expect(fancy.getName()).toBe('test-name');
      expect(fancy.getCount()).toBe(0);
    });

    it('should log the constructor message', () => {
      const name = 'test-fancy';
      new Fancy(name);
      
      expect(consoleSpy).toHaveBeenCalledWith(`Fancy constructor: ${name}`);
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle empty string names', () => {
      const fancy = new Fancy('');
      
      expect(fancy.getName()).toBe('');
      expect(consoleSpy).toHaveBeenCalledWith('Fancy constructor: ');
    });

    it('should handle special characters in names', () => {
      const specialName = 'test-name-123!@#$%';
      const fancy = new Fancy(specialName);
      
      expect(fancy.getName()).toBe(specialName);
      expect(consoleSpy).toHaveBeenCalledWith(`Fancy constructor: ${specialName}`);
    });
  });

  describe('getName', () => {
    it('should return the name set in constructor', () => {
      const name = 'my-fancy-name';
      const fancy = new Fancy(name);
      
      expect(fancy.getName()).toBe(name);
    });

    it('should return the same name on multiple calls', () => {
      const fancy = new Fancy('consistent-name');
      
      expect(fancy.getName()).toBe('consistent-name');
      expect(fancy.getName()).toBe('consistent-name');
      expect(fancy.getName()).toBe('consistent-name');
    });
  });

  describe('getCount', () => {
    it('should return 0 initially', () => {
      const fancy = new Fancy('test');
      
      expect(fancy.getCount()).toBe(0);
    });

    it('should return the same count on multiple calls if not modified', () => {
      const fancy = new Fancy('test');
      
      expect(fancy.getCount()).toBe(0);
      expect(fancy.getCount()).toBe(0);
      expect(fancy.getCount()).toBe(0);
    });
  });

  describe('addToCount', () => {
    it('should add positive numbers to the count', () => {
      const fancy = new Fancy('test');
      
      fancy.addToCount(5);
      expect(fancy.getCount()).toBe(5);
      
      fancy.addToCount(3);
      expect(fancy.getCount()).toBe(8);
    });

    it('should handle negative numbers (subtraction)', () => {
      const fancy = new Fancy('test');
      
      fancy.addToCount(10);
      expect(fancy.getCount()).toBe(10);
      
      fancy.addToCount(-3);
      expect(fancy.getCount()).toBe(7);
    });

    it('should handle zero', () => {
      const fancy = new Fancy('test');
      
      fancy.addToCount(5);
      expect(fancy.getCount()).toBe(5);
      
      fancy.addToCount(0);
      expect(fancy.getCount()).toBe(5);
    });

    it('should handle decimal numbers', () => {
      const fancy = new Fancy('test');
      
      fancy.addToCount(2.5);
      expect(fancy.getCount()).toBe(2.5);
      
      fancy.addToCount(1.7);
      expect(fancy.getCount()).toBe(4.2);
    });

    it('should handle large numbers', () => {
      const fancy = new Fancy('test');
      
      fancy.addToCount(1000000);
      expect(fancy.getCount()).toBe(1000000);
      
      fancy.addToCount(999999);
      expect(fancy.getCount()).toBe(1999999);
    });

    it('should allow count to go negative', () => {
      const fancy = new Fancy('test');
      
      fancy.addToCount(-5);
      expect(fancy.getCount()).toBe(-5);
      
      fancy.addToCount(-3);
      expect(fancy.getCount()).toBe(-8);
    });
  });

  describe('integration tests', () => {
    it('should work with multiple operations in sequence', () => {
      const fancy = new Fancy('integration-test');
      
      expect(fancy.getName()).toBe('integration-test');
      expect(fancy.getCount()).toBe(0);
      
      fancy.addToCount(10);
      expect(fancy.getCount()).toBe(10);
      
      fancy.addToCount(5);
      expect(fancy.getCount()).toBe(15);
      
      fancy.addToCount(-3);
      expect(fancy.getCount()).toBe(12);
      
      expect(fancy.getName()).toBe('integration-test'); // Name should remain unchanged
    });

    it('should maintain independent state across multiple instances', () => {
      const fancy1 = new Fancy('instance-1');
      const fancy2 = new Fancy('instance-2');
      
      fancy1.addToCount(10);
      fancy2.addToCount(20);
      
      expect(fancy1.getName()).toBe('instance-1');
      expect(fancy1.getCount()).toBe(10);
      
      expect(fancy2.getName()).toBe('instance-2');
      expect(fancy2.getCount()).toBe(20);
      
      // Verify they don't interfere with each other
      fancy1.addToCount(5);
      expect(fancy1.getCount()).toBe(15);
      expect(fancy2.getCount()).toBe(20); // Should remain unchanged
    });

    it('should log constructor message for each instance', () => {
      new Fancy('first');
      new Fancy('second');
      new Fancy('third');
      
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenNthCalledWith(1, 'Fancy constructor: first');
      expect(consoleSpy).toHaveBeenNthCalledWith(2, 'Fancy constructor: second');
      expect(consoleSpy).toHaveBeenNthCalledWith(3, 'Fancy constructor: third');
    });
  });

  describe('edge cases', () => {
    it('should handle very long names', () => {
      const longName = 'a'.repeat(1000);
      const fancy = new Fancy(longName);
      
      expect(fancy.getName()).toBe(longName);
      expect(consoleSpy).toHaveBeenCalledWith(`Fancy constructor: ${longName}`);
    });

    it('should handle names with newlines and special characters', () => {
      const weirdName = 'test\nwith\nnewlines\tand\ttabs';
      const fancy = new Fancy(weirdName);
      
      expect(fancy.getName()).toBe(weirdName);
      expect(consoleSpy).toHaveBeenCalledWith(`Fancy constructor: ${weirdName}`);
    });

    it('should handle extremely large count values', () => {
      const fancy = new Fancy('big-numbers');
      
      fancy.addToCount(Number.MAX_SAFE_INTEGER);
      expect(fancy.getCount()).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle extremely small count values', () => {
      const fancy = new Fancy('small-numbers');
      
      fancy.addToCount(Number.MIN_SAFE_INTEGER);
      expect(fancy.getCount()).toBe(Number.MIN_SAFE_INTEGER);
    });
  });
});
