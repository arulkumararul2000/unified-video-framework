import React, { useState, useEffect } from 'react';
import type { EPGComponentProps, EPGProgram, EPGProgramRow, EPGAction } from '../types/EPGTypes';
import { formatDateTime, getProgramDuration, isProgramLive, getProgramProgress } from '../utils/EPGUtils';

interface EPGProgramDetailsProps extends EPGComponentProps {
  program: EPGProgram | null;
  channel?: EPGProgramRow;
  onClose: () => void;
  onAction: (action: EPGAction) => void | Promise<void>;
  isModal?: boolean;
  currentTime?: number;
}

export const EPGProgramDetails: React.FC<EPGProgramDetailsProps> = ({
  program,
  channel,
  onClose,
  onAction,
  isModal = false,
  currentTime = Date.now(),
  className = '',
  style = {},
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error when program changes
  useEffect(() => {
    setError(null);
  }, [program]);

  if (!program) return null;

  const duration = getProgramDuration(program);
  const isLive = isProgramLive(program, currentTime);
  const progress = isLive ? getProgramProgress(program, currentTime) : 0;
  const hasEnded = new Date(program.till).getTime() < currentTime;

  // Handle action with error handling
  const handleAction = async (actionType: EPGAction['type']) => {
    if (!channel || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await onAction({
        type: actionType,
        program,
        channel,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Modal overlay click handler
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && isModal) {
      onClose();
    }
  };

  const detailsContent = (
    <div
      className={`epg-program-details ${isModal ? 'modal' : 'panel'} ${className}`}
      style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: isModal ? '12px' : '8px',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        maxWidth: isModal ? '600px' : '100%',
        maxHeight: isModal ? '80vh' : '100%',
        ...style,
      }}
    >
      {/* Header */}
      <div
        className="epg-details-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          padding: '20px',
          borderBottom: '1px solid #333',
          position: 'relative',
        }}
      >
        {/* Program Image */}
        {program.image && (
          <div
            style={{
              width: '120px',
              height: '68px',
              borderRadius: '8px',
              overflow: 'hidden',
              marginRight: '16px',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            <img
              src={program.image}
              alt={program.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            {isLive && (
              <div
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  backgroundColor: '#ff6b35',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                LIVE
              </div>
            )}
          </div>
        )}

        {/* Program Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <h2
            style={{
              color: '#fff',
              fontSize: '20px',
              fontWeight: '700',
              lineHeight: '1.3',
              margin: '0 0 8px 0',
            }}
          >
            {program.title}
          </h2>

          {/* Channel Name */}
          {channel && (
            <div
              style={{
                color: '#888',
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '8px',
              }}
            >
              {channel.programTitle}
            </div>
          )}

          {/* Time & Duration */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '8px',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              {formatDateTime(new Date(program.since).getTime())}
            </div>
            <div
              style={{
                color: '#888',
                fontSize: '13px',
              }}
            >
              {duration} min{duration !== 1 ? 's' : ''}
            </div>
            {program.category && (
              <div
                style={{
                  backgroundColor: '#333',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {program.category}
              </div>
            )}
            {program.rating && (
              <div
                style={{
                  backgroundColor: '#ff6b35',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                {program.rating}
              </div>
            )}
          </div>

          {/* Live Progress Bar */}
          {isLive && (
            <div
              style={{
                marginTop: '8px',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}
              >
                <span style={{ color: '#ff6b35', fontSize: '12px', fontWeight: '600' }}>
                  LIVE NOW
                </span>
                <span style={{ color: '#888', fontSize: '12px' }}>
                  {Math.round(progress)}% complete
                </span>
              </div>
              <div
                style={{
                  height: '4px',
                  backgroundColor: '#333',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    backgroundColor: '#ff6b35',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#333',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#333';
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div
        className="epg-details-content"
        style={{
          padding: '20px',
          maxHeight: isModal ? '300px' : 'none',
          overflow: 'auto',
        }}
      >
        {/* Description */}
        {program.description && (
          <div style={{ marginBottom: '20px' }}>
            <h3
              style={{
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '8px',
              }}
            >
              Description
            </h3>
            <p
              style={{
                color: '#ccc',
                fontSize: '14px',
                lineHeight: '1.5',
                margin: 0,
              }}
            >
              {program.description}
            </p>
          </div>
        )}

        {/* Status Indicators */}
        {(program.isFavorite || program.isRecording || program.hasReminder || program.hasCatchup) && (
          <div style={{ marginBottom: '20px' }}>
            <h3
              style={{
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '8px',
              }}
            >
              Status
            </h3>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              {program.isFavorite && (
                <span
                  style={{
                    backgroundColor: '#ff6b35',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '4px 8px',
                    borderRadius: '4px',
                  }}
                >
                  ★ Favorite
                </span>
              )}
              {program.isRecording && (
                <span
                  style={{
                    backgroundColor: '#e74c3c',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '4px 8px',
                    borderRadius: '4px',
                  }}
                >
                  ● Recording
                </span>
              )}
              {program.hasReminder && (
                <span
                  style={{
                    backgroundColor: '#3498db',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '4px 8px',
                    borderRadius: '4px',
                  }}
                >
                  🔔 Reminder
                </span>
              )}
              {program.hasCatchup && (
                <span
                  style={{
                    backgroundColor: '#2ecc71',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '4px 8px',
                    borderRadius: '4px',
                  }}
                >
                  ↻ Catchup
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            style={{
              backgroundColor: '#e74c3c',
              color: '#fff',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="epg-details-actions"
        style={{
          padding: '20px',
          borderTop: '1px solid #333',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Add to Favorite */}
        <button
          onClick={() => handleAction('favorite')}
          disabled={isLoading}
          style={{
            flex: '1 1 120px',
            height: '40px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: program.isFavorite ? '#ff6b35' : '#333',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '600',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = program.isFavorite ? '#ff8555' : '#444';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = program.isFavorite ? '#ff6b35' : '#333';
            }
          }}
        >
          ★ {program.isFavorite ? 'Favorited' : 'Favorite'}
        </button>

        {/* Record */}
        {!hasEnded && (
          <button
            onClick={() => handleAction('record')}
            disabled={isLoading}
            style={{
              flex: '1 1 120px',
              height: '40px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: program.isRecording ? '#e74c3c' : '#333',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = program.isRecording ? '#c0392b' : '#444';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = program.isRecording ? '#e74c3c' : '#333';
              }
            }}
          >
            ● {program.isRecording ? 'Recording' : 'Record'}
          </button>
        )}

        {/* Set Reminder */}
        {!isLive && !hasEnded && (
          <button
            onClick={() => handleAction('reminder')}
            disabled={isLoading}
            style={{
              flex: '1 1 120px',
              height: '40px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: program.hasReminder ? '#3498db' : '#333',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = program.hasReminder ? '#2980b9' : '#444';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = program.hasReminder ? '#3498db' : '#333';
              }
            }}
          >
            🔔 {program.hasReminder ? 'Reminder Set' : 'Remind Me'}
          </button>
        )}

        {/* Catchup */}
        {hasEnded && (
          <button
            onClick={() => handleAction('catchup')}
            disabled={isLoading}
            style={{
              flex: '1 1 120px',
              height: '40px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#2ecc71',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#27ae60';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#2ecc71';
              }
            }}
          >
            ↻ Watch Catchup
          </button>
        )}
      </div>
    </div>
  );

  // Render as modal or inline panel
  if (isModal) {
    return (
      <div
        className="epg-modal-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}
        onClick={handleOverlayClick}
      >
        {detailsContent}
      </div>
    );
  }

  return detailsContent;
};

export default EPGProgramDetails;