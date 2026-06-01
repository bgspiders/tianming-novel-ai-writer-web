import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
class ChatHubClient {
    connection = null;
    starting = null;
    tokenHandlers = new Set();
    statusHandlers = new Set();
    completedHandlers = new Set();
    errorHandlers = new Set();
    runEventHandlers = new Set();
    buildConnection() {
        const connection = new HubConnectionBuilder()
            .withUrl('/hubs/chat')
            .withAutomaticReconnect()
            .configureLogging(LogLevel.Warning)
            .build();
        connection.on('ReceiveToken', (token) => {
            this.tokenHandlers.forEach((handler) => handler(token));
        });
        connection.on('Status', (status) => {
            this.statusHandlers.forEach((handler) => handler(status));
        });
        connection.on('Completed', (reason) => {
            this.completedHandlers.forEach((handler) => handler(reason));
        });
        connection.on('Error', (message) => {
            this.errorHandlers.forEach((handler) => handler(message));
        });
        connection.on('RunEvent', (event) => {
            this.runEventHandlers.forEach((handler) => handler(event));
        });
        return connection;
    }
    async ensureStarted() {
        if (this.connection && this.connection.state === HubConnectionState.Connected) {
            return;
        }
        if (this.starting) {
            return this.starting;
        }
        if (!this.connection) {
            this.connection = this.buildConnection();
        }
        this.starting = this.connection.start().finally(() => {
            this.starting = null;
        });
        return this.starting;
    }
    async joinRun(runId) {
        await this.ensureStarted();
        await this.connection.invoke('JoinRun', runId);
    }
    async leaveRun(runId) {
        if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
            return;
        }
        try {
            await this.connection.invoke('LeaveRun', runId);
        }
        catch {
            // Ignore transient disconnects while leaving a run.
        }
    }
    onToken(handler) {
        this.tokenHandlers.add(handler);
    }
    offToken(handler) {
        this.tokenHandlers.delete(handler);
    }
    onStatus(handler) {
        this.statusHandlers.add(handler);
    }
    offStatus(handler) {
        this.statusHandlers.delete(handler);
    }
    onCompleted(handler) {
        this.completedHandlers.add(handler);
    }
    offCompleted(handler) {
        this.completedHandlers.delete(handler);
    }
    onError(handler) {
        this.errorHandlers.add(handler);
    }
    offError(handler) {
        this.errorHandlers.delete(handler);
    }
    onRunEvent(handler) {
        this.runEventHandlers.add(handler);
    }
    offRunEvent(handler) {
        this.runEventHandlers.delete(handler);
    }
}
export const chatHub = new ChatHubClient();
