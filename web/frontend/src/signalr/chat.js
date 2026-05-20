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
        const conn = new HubConnectionBuilder()
            .withUrl('/hubs/chat')
            .withAutomaticReconnect()
            .configureLogging(LogLevel.Warning)
            .build();
        conn.on('ReceiveToken', (token) => {
            this.tokenHandlers.forEach((h) => h(token));
        });
        conn.on('Status', (status) => {
            this.statusHandlers.forEach((h) => h(status));
        });
        conn.on('Completed', (reason) => {
            this.completedHandlers.forEach((h) => h(reason));
        });
        conn.on('Error', (msg) => {
            this.errorHandlers.forEach((h) => h(msg));
        });
        conn.on('RunEvent', (event) => {
            this.runEventHandlers.forEach((h) => h(event));
        });
        return conn;
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
            // 关闭过程中的失败可忽略
        }
    }
    onToken(handler) { this.tokenHandlers.add(handler); }
    offToken(handler) { this.tokenHandlers.delete(handler); }
    onStatus(handler) { this.statusHandlers.add(handler); }
    offStatus(handler) { this.statusHandlers.delete(handler); }
    onCompleted(handler) { this.completedHandlers.add(handler); }
    offCompleted(handler) { this.completedHandlers.delete(handler); }
    onError(handler) { this.errorHandlers.add(handler); }
    offError(handler) { this.errorHandlers.delete(handler); }
    onRunEvent(handler) { this.runEventHandlers.add(handler); }
    offRunEvent(handler) { this.runEventHandlers.delete(handler); }
}
export const chatHub = new ChatHubClient();
