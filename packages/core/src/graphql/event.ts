export const INSERT_EVENT = `
  mutation insert_events_one($data: events_insert_input!) {
    insert_events_one(object: $data) {
      id
    }
  }
`;

export const UPDATE_EVENT = `
  mutation update_events_by_pk($id: uuid!, $data: events_set_input!) {
    update_events_by_pk(pk_columns: { id: $id }, _set: $data) {
      id
    }
  }
`;

export const SUBSCRIBE_EVENTS = `
  subscription events {
    events {
      id
      name
      creator {
        id
        displayName
      }
      participants {
        user {
          id
          displayName
        }
      }
    }
  }
`;

export const INSERT_EVENT_PARTICIPANT = `
  mutation insert_event_participants_one($data: event_participants_insert_input!) {
    insert_event_participants_one(object: $data) {
      eventId
    }
  }
`;
