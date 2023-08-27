export const UPSERT_INSTALLATION = `
  mutation insert_installations_one($data: installations_insert_input!) {
    insert_installations_one(object: $data, on_conflict: { constraint: installations_pkey, update_columns: [deviceName, osName, osVersion, pushToken, appVersion, appIdentifier, deviceType, deviceLocale] }) {
      id
    }
  }
`;

export const UPDATE_INSTALLATION = `
  mutation update_installations_by_pk($id: uuid!, $userId: uuid!, $data: installations_set_input!) {
    update_installations_by_pk(pk_columns: { id: $id, userId: $userId }, _set: $data) {
      id
    }
  }
`;
