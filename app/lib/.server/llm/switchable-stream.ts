import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('SwitchableStream');

export default class SwitchableStream extends TransformStream {
  private _controller: TransformStreamDefaultController | null = null;
  private _currentReader: ReadableStreamDefaultReader | null = null;
  private _switches = 0;
  private _isActive = true;
  private _errorCount = 0;
  private _maxErrors = 10; // Max errors before stopping the stream
  private _pumpingPromise: Promise<void> | null = null;

  constructor() {
    let controllerRef: TransformStreamDefaultController | undefined;

    super({
      start(controller) {
        controllerRef = controller;
      },
      cancel() {
        // Clean up when the stream is canceled
        logger.info('Stream canceled, cleaning up');
      },
    });

    if (controllerRef === undefined) {
      throw new Error('Controller not properly initialized');
    }

    this._controller = controllerRef;
  }

  async switchSource(newStream: ReadableStream) {
    if (!this._isActive) {
      logger.warn('Cannot switch source on inactive stream');
      return;
    }

    try {
      // Wait for any existing pumping to finish
      if (this._pumpingPromise) {
        await this._pumpingPromise.catch(() => {
          // Ignore errors from previous pump
        });
      }

      // Cancel the current reader if it exists
      if (this._currentReader) {
        try {
          await this._currentReader.cancel();
          this._currentReader.releaseLock?.();
        } catch (error) {
          logger.warn('Error canceling previous reader:', error);
        }
      }

      this._currentReader = newStream.getReader();
      this._switches++;

      logger.info(`Switching to source #${this._switches}`);

      // Start pumping the new stream
      this._pumpingPromise = this._pumpStream();
    } catch (error) {
      logger.error('Error switching stream source:', error);
      this._handleError(error);
    }
  }

  private async _pumpStream() {
    if (!this._currentReader || !this._controller) {
      throw new Error('Stream is not properly initialized');
    }

    try {
      while (this._isActive) {
        const { done, value } = await this._currentReader.read();

        if (done) {
          logger.info('Stream read complete');
          break;
        }

        if (!this._controller) {
          logger.warn('Controller became null during streaming');
          break;
        }

        this._controller.enqueue(value);
      }
    } catch (error) {
      this._handleError(error);
    }
  }

  private _handleError(error: any) {
    this._errorCount++;
    logger.error(`Stream error #${this._errorCount}:`, error);

    if (this._errorCount >= this._maxErrors) {
      logger.error(`Max errors (${this._maxErrors}) reached, terminating stream`);
      this._isActive = false;

      if (this._controller) {
        try {
          this._controller.error(new Error(`Stream failed after ${this._errorCount} errors. Last error: ${error.message}`));
        } catch (e) {
          logger.error('Error while reporting error to controller:', e);
        }
      }
    } else if (this._controller) {
      // Don't terminate on first few errors, just log them
      logger.warn('Stream error occurred but will continue');
    }
  }

  close() {
    this._isActive = false;

    if (this._currentReader) {
      try {
        this._currentReader.cancel();
        this._currentReader.releaseLock?.();
      } catch (error) {
        logger.error('Error closing reader:', error);
      }
      this._currentReader = null;
    }

    if (this._controller) {
      try {
        this._controller.terminate();
      } catch (error) {
        logger.error('Error terminating controller:', error);
      }
      this._controller = null;
    }

    logger.info(`Stream closed after ${this._switches} switches and ${this._errorCount} errors`);
  }

  get switches() {
    return this._switches;
  }

  get isActive() {
    return this._isActive;
  }

  get errorCount() {
    return this._errorCount;
  }
}
