import { useState } from 'react';

import { PermissionType } from './permissions/permissionFactory';
import { usePermission } from './usePermission';

export function useMandatoryPermission(type: PermissionType, options?: { when: boolean }) {
  const { when = true } = options || {};

  const { status, request, openSettings, isRequesting } = usePermission(type);

  const [isFirstAsk, setIsFirstAsk] = useState(true);

  const [dialogVisible, setDialogVisible] = useState(false);

  if (when && status && !status.granted && (!status.canAskAgain || !isFirstAsk) && !isRequesting && !dialogVisible) {
    setDialogVisible(true);
  } else if (status?.granted && dialogVisible) {
    setDialogVisible(false);
  }

  if (when && !status?.granted && status?.canAskAgain && isFirstAsk && !isRequesting) {
    setIsFirstAsk(false);
    request();
  }

  const requestPermission = async () => {
    if (status?.canAskAgain) {
      setIsFirstAsk(false);
      return request();
    }
    return openSettings();
  };

  return { status, request: requestPermission, dialogVisible };
}
