import { useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';

export function useCrmRealtime(onLeadIngested, currentUser) {
  const [status, setStatus] = useState('Disconnected');

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (!currentUser || !token) {
      setStatus('Disconnected');
      return;
    }

    // Use environment variable for API URL, or fallback to localhost
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5260/api';
    const hubUrl = apiBaseUrl.replace('/api', '') + '/hubs/crm';

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => localStorage.getItem('crm_token') || '',
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connection.on('LeadIngested', (payload) => {
      if (onLeadIngested) onLeadIngested(payload);
    });

    connection.onreconnecting(() => setStatus('Reconnecting...'));
    connection.onreconnected(() => setStatus('Connected'));
    connection.onclose(() => setStatus('Disconnected'));

    connection
      .start()
      .then(() => setStatus('Connected'))
      .catch((err) => {
        console.error('SignalR Connection Error:', err);
        setStatus('Disconnected');
      });

    return () => {
      connection.stop();
    };
  }, [onLeadIngested, currentUser?.id, currentUser?.tenantId, currentUser?.canViewAllCompanyLeads]);

  return status;
}