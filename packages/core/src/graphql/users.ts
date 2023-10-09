export const INSERT_USER_FILE = `
  mutation insert_user_files_one($data: user_files_insert_input!) {
    insert_user_files_one(object: $data) {
      userId
      fileId
    }
  }
`;
