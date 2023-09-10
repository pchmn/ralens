import { Text } from '@ralens/react-native';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Portal } from 'react-native-paper';

interface PermissionDialogProps {
  visible: boolean;
  title: string;
  content: string;
  grantButtonText: string;
  onDismiss: () => void;
  onGrant: () => void;
}

export function PermissionDialog({
  visible,
  title,
  content,
  grantButtonText,
  onDismiss,
  onGrant,
}: PermissionDialogProps) {
  const { t } = useTranslation();

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} dismissable={false}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{content}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('camera.cameraPermissionDialog.dismiss')}</Button>
          <Button onPress={onGrant}>{grantButtonText}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
