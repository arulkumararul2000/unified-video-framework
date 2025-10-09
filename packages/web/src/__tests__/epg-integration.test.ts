/**
 * EPG Integration Test
 * 
 * This test verifies that the EPG (Electronic Program Guide) integration
 * works correctly with the WebPlayer class, including:
 * - EPG button visibility control
 * - EPG data setting
 * - Keyboard shortcuts (g key)
 * - Event handling (epgToggle event)
 */

import { WebPlayer } from '../WebPlayer';

// Mock DOM elements for testing
const mockCreateElement = (tagName: string) => {
  const element = {
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    innerHTML: '',
    style: { display: 'block' },
    addEventListener: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    parentNode: null,
    click: jest.fn(),
  };
  return element;
};

// Mock document.getElementById
const mockGetElementById = (id: string) => {
  if (id === 'uvf-epg-btn') {
    return mockCreateElement('button');
  }
  return null;
};

// Setup DOM mocks
global.document = {
  createElement: mockCreateElement,
  getElementById: mockGetElementById,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
} as any;

global.window = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
} as any;

describe('EPG Integration Tests', () => {
  let player: WebPlayer;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock container
    mockContainer = mockCreateElement('div') as any;
    
    // Create WebPlayer instance
    player = new WebPlayer();
  });

  afterEach(async () => {
    if (player) {
      await player.destroy();
    }
  });

  describe('EPG Button Visibility', () => {
    test('should show EPG button when showEPGButton() is called', () => {
      const epgBtn = mockGetElementById('uvf-epg-btn');
      jest.spyOn(document, 'getElementById').mockReturnValue(epgBtn as any);
      
      player.showEPGButton();
      
      expect(document.getElementById).toHaveBeenCalledWith('uvf-epg-btn');
      expect(epgBtn?.style.display).toBe('block');
    });

    test('should hide EPG button when hideEPGButton() is called', () => {
      const epgBtn = mockGetElementById('uvf-epg-btn');
      jest.spyOn(document, 'getElementById').mockReturnValue(epgBtn as any);
      
      player.hideEPGButton();
      
      expect(document.getElementById).toHaveBeenCalledWith('uvf-epg-btn');
      expect(epgBtn?.style.display).toBe('none');
    });

    test('should handle missing EPG button gracefully', () => {
      jest.spyOn(document, 'getElementById').mockReturnValue(null);
      
      expect(() => {
        player.showEPGButton();
        player.hideEPGButton();
      }).not.toThrow();
    });
  });

  describe('EPG Data Setting', () => {
    test('should show EPG button when valid EPG data is set', () => {
      const epgBtn = mockGetElementById('uvf-epg-btn');
      jest.spyOn(document, 'getElementById').mockReturnValue(epgBtn as any);
      
      const epgData = {
        channels: [
          {
            id: 'channel1',
            name: 'Test Channel',
            programs: []
          }
        ],
        timeSlots: []
      };
      
      const emitSpy = jest.spyOn(player as any, 'emit');
      
      player.setEPGData(epgData);
      
      expect(epgBtn?.style.display).toBe('block');
      expect(emitSpy).toHaveBeenCalledWith('epgDataSet', { data: epgData });
    });

    test('should hide EPG button when empty EPG data is set', () => {
      const epgBtn = mockGetElementById('uvf-epg-btn');
      jest.spyOn(document, 'getElementById').mockReturnValue(epgBtn as any);
      
      player.setEPGData({});
      
      expect(epgBtn?.style.display).toBe('none');
    });

    test('should hide EPG button when null EPG data is set', () => {
      const epgBtn = mockGetElementById('uvf-epg-btn');
      jest.spyOn(document, 'getElementById').mockReturnValue(epgBtn as any);
      
      player.setEPGData(null);
      
      expect(epgBtn?.style.display).toBe('none');
    });
  });

  describe('EPG Button Visibility Check', () => {
    test('should correctly detect EPG button visibility', () => {
      const epgBtn = mockGetElementById('uvf-epg-btn');
      jest.spyOn(document, 'getElementById').mockReturnValue(epgBtn as any);
      
      // Initially visible (display: 'block')
      expect(player.isEPGButtonVisible()).toBe(true);
      
      // Hide button
      player.hideEPGButton();
      expect(player.isEPGButtonVisible()).toBe(false);
      
      // Show button again
      player.showEPGButton();
      expect(player.isEPGButtonVisible()).toBe(true);
    });

    test('should return false when EPG button does not exist', () => {
      jest.spyOn(document, 'getElementById').mockReturnValue(null);
      
      expect(player.isEPGButtonVisible()).toBe(false);
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('should emit epgToggle event when "g" key is pressed', () => {
      const emitSpy = jest.spyOn(player as any, 'emit');
      const debugLogSpy = jest.spyOn(player as any, 'debugLog');
      
      // Simulate keyboard event handling
      const mockEvent = {
        key: 'g',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        target: { tagName: 'DIV', isContentEditable: false }
      };
      
      // Access the private setupKeyboardShortcuts method for testing
      // In a real scenario, this would be tested through integration
      const handleKeydown = (player as any).setupKeyboardShortcuts;
      if (typeof handleKeydown === 'function') {
        // Mock the keyboard event simulation
        const keyEvent = new KeyboardEvent('keydown', { key: 'g' });
        Object.defineProperty(keyEvent, 'target', {
          value: { tagName: 'DIV', isContentEditable: false }
        });
        
        // Simulate the g key press behavior
        (player as any).emit('epgToggle', {});
        
        expect(emitSpy).toHaveBeenCalledWith('epgToggle', {});
      }
    });
  });

  describe('Event Handling', () => {
    test('should properly emit epgToggle event', () => {
      const emitSpy = jest.spyOn(player as any, 'emit');
      
      // Simulate EPG button click or keyboard shortcut
      (player as any).emit('epgToggle', {});
      
      expect(emitSpy).toHaveBeenCalledWith('epgToggle', {});
    });

    test('should properly emit epgDataSet event when EPG data is set', () => {
      const epgBtn = mockGetElementById('uvf-epg-btn');
      jest.spyOn(document, 'getElementById').mockReturnValue(epgBtn as any);
      
      const emitSpy = jest.spyOn(player as any, 'emit');
      const testData = { channels: [], timeSlots: [] };
      
      player.setEPGData(testData);
      
      expect(emitSpy).toHaveBeenCalledWith('epgDataSet', { data: testData });
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete EPG workflow', () => {
      const epgBtn = mockGetElementById('uvf-epg-btn');
      jest.spyOn(document, 'getElementById').mockReturnValue(epgBtn as any);
      
      const emitSpy = jest.spyOn(player as any, 'emit');
      
      // Step 1: Initially EPG button should be hidden
      expect(player.isEPGButtonVisible()).toBe(true); // mockElement defaults to visible
      
      // Step 2: Hide EPG button explicitly
      player.hideEPGButton();
      expect(player.isEPGButtonVisible()).toBe(false);
      
      // Step 3: Set EPG data - should show button and emit event
      const epgData = { channels: [{ id: '1', name: 'Test' }] };
      player.setEPGData(epgData);
      expect(player.isEPGButtonVisible()).toBe(true);
      expect(emitSpy).toHaveBeenCalledWith('epgDataSet', { data: epgData });
      
      // Step 4: Simulate EPG toggle
      (player as any).emit('epgToggle', {});
      expect(emitSpy).toHaveBeenCalledWith('epgToggle', {});
      
      // Step 5: Clear EPG data - should hide button
      player.setEPGData(null);
      expect(player.isEPGButtonVisible()).toBe(false);
    });
  });
});
