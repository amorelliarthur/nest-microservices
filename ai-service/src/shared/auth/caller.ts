// Who the assistant acts on behalf of when calling other internal services.
// The token is the one received from the gateway, forwarded as-is.
export interface Caller {
  userId: string;
  internalToken: string;
}
