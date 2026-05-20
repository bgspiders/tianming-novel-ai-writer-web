import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from '@microsoft/signalr'

export type TokenHandler = (token: string) => void
export type StatusHandler = (status: string) => void
export type CompletedHandler = (finishReason: string) => void
export type ErrorHandler = (message: string) => void
export type RunEventType =
  | 'assistant.parsed'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'tool.cancelled'
  | string

export interface RunEvent {
  type: RunEventType
  message: string
  at: string
  data?: unknown
}

export type RunEventHandler = (event: RunEvent) => void

class ChatHubClient {
  private connection: HubConnection | null = null
  private starting: Promise<void> | null = null

  private tokenHandlers = new Set<TokenHandler>()
  private statusHandlers = new Set<StatusHandler>()
  private completedHandlers = new Set<CompletedHandler>()
  private errorHandlers = new Set<ErrorHandler>()
  private runEventHandlers = new Set<RunEventHandler>()

  private buildConnection(): HubConnection {
    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/chat')
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('ReceiveToken', (token: string) => {
      this.tokenHandlers.forEach((handler) => handler(token))
    })
    connection.on('Status', (status: string) => {
      this.statusHandlers.forEach((handler) => handler(status))
    })
    connection.on('Completed', (reason: string) => {
      this.completedHandlers.forEach((handler) => handler(reason))
    })
    connection.on('Error', (message: string) => {
      this.errorHandlers.forEach((handler) => handler(message))
    })
    connection.on('RunEvent', (event: RunEvent) => {
      this.runEventHandlers.forEach((handler) => handler(event))
    })

    return connection
  }

  async ensureStarted(): Promise<void> {
    if (this.connection && this.connection.state === HubConnectionState.Connected) {
      return
    }
    if (this.starting) {
      return this.starting
    }
    if (!this.connection) {
      this.connection = this.buildConnection()
    }

    this.starting = this.connection.start().finally(() => {
      this.starting = null
    })

    return this.starting
  }

  async joinRun(runId: string): Promise<void> {
    await this.ensureStarted()
    await this.connection!.invoke('JoinRun', runId)
  }

  async leaveRun(runId: string): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return
    }

    try {
      await this.connection.invoke('LeaveRun', runId)
    } catch {
      // Ignore transient disconnects while leaving a run.
    }
  }

  onToken(handler: TokenHandler) {
    this.tokenHandlers.add(handler)
  }

  offToken(handler: TokenHandler) {
    this.tokenHandlers.delete(handler)
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler)
  }

  offStatus(handler: StatusHandler) {
    this.statusHandlers.delete(handler)
  }

  onCompleted(handler: CompletedHandler) {
    this.completedHandlers.add(handler)
  }

  offCompleted(handler: CompletedHandler) {
    this.completedHandlers.delete(handler)
  }

  onError(handler: ErrorHandler) {
    this.errorHandlers.add(handler)
  }

  offError(handler: ErrorHandler) {
    this.errorHandlers.delete(handler)
  }

  onRunEvent(handler: RunEventHandler) {
    this.runEventHandlers.add(handler)
  }

  offRunEvent(handler: RunEventHandler) {
    this.runEventHandlers.delete(handler)
  }
}

export const chatHub = new ChatHubClient()
