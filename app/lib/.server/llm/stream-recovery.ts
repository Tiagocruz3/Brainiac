import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('stream-recovery');

export interface StreamRecoveryOptions {
  maxRetries?: number;
  timeout?: number;
  onTimeout?: () => void | Promise<void>;
  onRecovery?: () => void;
  onMaxRetriesReached?: () => void;
  useExponentialBackoff?: boolean;
}

export class StreamRecoveryManager {
  private _retryCount = 0;
  private _timeoutHandle: NodeJS.Timeout | null = null;
  private _lastActivity: number = Date.now();
  private _isActive = true;
  private _consecutiveFailures = 0;
  private _lastErrorTime: number | null = null;

  constructor(private _options: StreamRecoveryOptions = {}) {
    this._options = {
      maxRetries: 5, // Increased from 3
      timeout: 60000, // Increased from 30s to 60s for better stability
      useExponentialBackoff: true,
      ..._options,
    };
  }

  startMonitoring() {
    this._resetTimeout();
  }

  updateActivity() {
    this._lastActivity = Date.now();
    this._consecutiveFailures = 0; // Reset failure counter on successful activity
    this._resetTimeout();
  }

  private _resetTimeout() {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
    }

    if (!this._isActive) {
      return;
    }

    // Calculate timeout with exponential backoff if enabled
    let timeoutDuration = this._options.timeout || 60000;

    if (this._options.useExponentialBackoff && this._retryCount > 0) {
      // Exponential backoff: timeout * 2^retryCount (capped at 5 minutes)
      timeoutDuration = Math.min(timeoutDuration * Math.pow(2, this._retryCount), 300000);
      logger.info(`Using exponential backoff: ${timeoutDuration}ms for retry ${this._retryCount}`);
    }

    this._timeoutHandle = setTimeout(() => {
      if (this._isActive) {
        logger.warn('Stream timeout detected');
        this._handleTimeout();
      }
    }, timeoutDuration);
  }

  private async _handleTimeout() {
    this._consecutiveFailures++;
    this._lastErrorTime = Date.now();

    if (this._retryCount >= (this._options.maxRetries || 5)) {
      logger.error(`Max retries (${this._options.maxRetries}) reached for stream recovery`);
      this.stop();

      if (this._options.onMaxRetriesReached) {
        this._options.onMaxRetriesReached();
      }

      return;
    }

    this._retryCount++;
    logger.info(`Attempting stream recovery (attempt ${this._retryCount}/${this._options.maxRetries})`);

    if (this._options.onTimeout) {
      try {
        await this._options.onTimeout();
      } catch (error) {
        logger.error('Error during timeout callback:', error);
      }
    }

    // Reset monitoring after recovery attempt
    this._resetTimeout();

    if (this._options.onRecovery) {
      this._options.onRecovery();
    }
  }

  reportError() {
    this._consecutiveFailures++;
    this._lastErrorTime = Date.now();
  }

  stop() {
    this._isActive = false;

    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
      this._timeoutHandle = null;
    }
  }

  reset() {
    this._retryCount = 0;
    this._consecutiveFailures = 0;
    this._lastActivity = Date.now();
    this._lastErrorTime = null;
    this._resetTimeout();
  }

  getStatus() {
    return {
      isActive: this._isActive,
      retryCount: this._retryCount,
      consecutiveFailures: this._consecutiveFailures,
      lastActivity: this._lastActivity,
      lastErrorTime: this._lastErrorTime,
      timeSinceLastActivity: Date.now() - this._lastActivity,
      healthScore: this._calculateHealthScore(),
    };
  }

  private _calculateHealthScore(): number {
    // Health score from 0-100, lower with more failures and higher retry counts
    const failurePenalty = this._consecutiveFailures * 20;
    const retryPenalty = this._retryCount * 15;
    const timeSinceActivity = Date.now() - this._lastActivity;
    const stalePenalty = timeSinceActivity > 30000 ? 10 : 0;

    return Math.max(0, 100 - failurePenalty - retryPenalty - stalePenalty);
  }

  isHealthy(): boolean {
    return this._calculateHealthScore() > 50 && this._isActive;
  }
}
