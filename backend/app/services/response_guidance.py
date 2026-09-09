"""Deterministic, rule-based response guidance engine.

Given an alert (and optionally the incident it belongs to), produce a
plain-language explanation of what happened, why it matters, what should be
reviewed, and what a possible (human-approved, non-destructive) resolution
looks like. This is template-driven, contextual logic - not an LLM.
"""
from app.models.event import Event
from app.models.incident import Incident

WHAT_HAPPENED = {
    "LOGIN_FAILED": "An authentication attempt failed for this account.",
    "LOGIN_SUCCESS": "A successful authentication occurred for this account.",
    "NEW_DEVICE": "A login or action occurred from a device not previously associated with this user.",
    "PRIVILEGE_CHANGE": "The account's privilege level was changed.",
    "FILE_ACCESS": "A file or resource was accessed.",
    "NETWORK_CONNECTION": "A network connection was established to an external or internal destination.",
    "PROCESS_EXECUTION": "A process was executed on the affected device.",
    "DATA_TRANSFER": "Data was transferred out of or within the environment.",
    "LOGOUT": "The user's session ended.",
}

WHY_IT_MATTERS = {
    "LOGIN_FAILED": "Repeated authentication failures may indicate credential stuffing or an attempted account takeover.",
    "LOGIN_SUCCESS": "A successful login following suspicious activity may indicate the attacker gained access, or may be entirely legitimate - context matters.",
    "NEW_DEVICE": "Access from an unrecognized device can indicate account compromise, especially when paired with unusual location or timing.",
    "PRIVILEGE_CHANGE": "Privilege escalation is one of the highest-impact actions an attacker can take, since it expands what the account can access or modify.",
    "FILE_ACCESS": "Access to sensitive files outside of normal patterns may indicate data reconnaissance ahead of exfiltration.",
    "NETWORK_CONNECTION": "Connections to unfamiliar or unexpected destinations can indicate command-and-control activity or data staging.",
    "PROCESS_EXECUTION": "Unexpected process execution can indicate malware, a living-off-the-land technique, or unauthorized administrative activity.",
    "DATA_TRANSFER": "Large or unusual data transfers are a common final stage of a data exfiltration sequence.",
    "LOGOUT": "Session termination is routine but can be relevant when reviewing the boundaries of an incident timeline.",
}

REVIEW_STEPS = {
    "LOGIN_FAILED": [
        "Review authentication history for the affected account.",
        "Check whether a successful login followed the failures.",
        "Inspect the source IP and device associated with the attempts.",
        "Check for unusual location or device activity around this time.",
        "Review any subsequent privileged actions taken on this account.",
    ],
    "LOGIN_SUCCESS": [
        "Confirm whether this login followed recent failed attempts from the same account.",
        "Compare the source IP and device against the user's typical activity.",
        "Review actions performed immediately after this login.",
    ],
    "NEW_DEVICE": [
        "Verify whether the device is expected for this user.",
        "Compare it with the user's previously observed devices.",
        "Review the source IP and approximate location for this session.",
        "Inspect actions performed after the login from this device.",
    ],
    "PRIVILEGE_CHANGE": [
        "Verify whether the privilege change was authorized through a change process.",
        "Identify who or what initiated the change.",
        "Review authentication events immediately preceding the change.",
        "Review actions performed by the account after escalation.",
    ],
    "FILE_ACCESS": [
        "Verify whether this access is expected for this user's role.",
        "Identify the user and device that performed the access.",
        "Review activity immediately before and after the access.",
        "Check for subsequent data transfer activity involving this resource.",
    ],
    "NETWORK_CONNECTION": [
        "Identify the destination and determine whether it is expected.",
        "Review connection timing and frequency for this device.",
        "Correlate with endpoint and user activity around the same time.",
    ],
    "PROCESS_EXECUTION": [
        "Verify whether this process is expected on this device.",
        "Review the parent process and how it was launched.",
        "Check for related file or network activity from the same device.",
    ],
    "DATA_TRANSFER": [
        "Identify the destination and volume of the transfer.",
        "Review whether the account or device has a legitimate reason for this transfer.",
        "Correlate with recent file access and privilege events for the same entity.",
    ],
    "LOGOUT": [
        "Confirm this logout aligns with the rest of the session timeline.",
    ],
}

POSSIBLE_RESOLUTION = {
    "LOGIN_FAILED": [
        "If confirmed suspicious, consider requiring a password reset for the affected account per organizational policy.",
        "Continue investigation of related authentication events before taking further action.",
    ],
    "LOGIN_SUCCESS": [
        "If the login cannot be confirmed as expected, consider temporarily restricting the account pending review.",
    ],
    "NEW_DEVICE": [
        "If unexpected, consider requiring device re-verification for this user.",
        "Document the device as known if confirmed legitimate.",
    ],
    "PRIVILEGE_CHANGE": [
        "If unauthorized, consider reverting the privilege change after review and involving an administrator.",
        "If authorized, document the change and close out the review.",
    ],
    "FILE_ACCESS": [
        "If unexpected, consider restricting access to the resource pending review.",
        "Document the access as expected if it aligns with the user's role.",
    ],
    "NETWORK_CONNECTION": [
        "If the destination is confirmed unexpected, consider flagging it for network-level review.",
    ],
    "PROCESS_EXECUTION": [
        "If unrecognized, consider isolating the device for deeper endpoint review per organizational policy.",
    ],
    "DATA_TRANSFER": [
        "If unauthorized, consider restricting the account and reviewing data loss prevention controls.",
    ],
    "LOGOUT": [
        "No action typically required.",
    ],
}

DEFAULT_REVIEW = ["Review the surrounding event timeline for this entity.", "Confirm whether the activity matches expected behavior."]
DEFAULT_RESOLUTION = ["Document findings and update the alert status once reviewed."]


def build_guidance(event: Event, incident: Incident | None, correlated_events: list[Event] | None = None) -> dict:
    event_type = event.event_type
    what_happened = WHAT_HAPPENED.get(event_type, "A security-relevant event was recorded.")
    why = WHY_IT_MATTERS.get(event_type, "This event type may be relevant to an ongoing investigation.")
    review = list(REVIEW_STEPS.get(event_type, DEFAULT_REVIEW))
    resolution = list(POSSIBLE_RESOLUTION.get(event_type, DEFAULT_RESOLUTION))

    # Contextual augmentation based on correlation / incident membership.
    if incident is not None:
        why += f" This alert is part of incident \"{incident.title}\" ({incident.id}), which currently has a risk score of {incident.risk_score}/100."
        review.append(f"Review the other {max(0, incident.__dict__.get('_alert_count', len(incident.events)) - 1)} correlated alert(s) in {incident.id} for the full picture.")

    if correlated_events:
        entities = sorted({e.user for e in correlated_events if e.user})
        if entities:
            review.append(f"Cross-reference activity for: {', '.join(entities)}.")

    return {
        "alert_id": event.id,
        "what_happened": what_happened,
        "why_it_matters": why,
        "review_steps": review,
        "possible_resolution": resolution,
        "severity": event.severity,
    }
