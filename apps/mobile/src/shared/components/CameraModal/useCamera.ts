import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { gravity, SensorTypes, setUpdateIntervalForType } from 'react-native-sensors';
import {
  Camera,
  CameraCaptureError,
  CameraDevice,
  CameraDeviceFormat,
  useCameraDevices,
  VideoFile,
} from 'react-native-vision-camera';

export type FlashMode = 'on' | 'off' | 'auto';

setUpdateIntervalForType(SensorTypes.gravity, 1000);

export function useCamera(ratio: '16:9' | '4:3' = '16:9') {
  const devices = useCameraDevices();
  const [device, setDevice] = useState<CameraDevice | undefined>();
  const [orientation, setOrientation] = useState<
    'portrait' | 'portraitUpsideDown' | 'landscapeLeft' | 'landscapeRight'
  >('portrait');
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const subscription = gravity.subscribe(({ x, y }) => {
      const radian = Math.atan2(y, x);
      const degree = (radian * 180) / Math.PI;

      if (degree > 135) {
        setOrientation(Platform.OS === 'android' ? 'landscapeLeft' : 'landscapeRight');
      } else if (degree > 45) {
        setOrientation(Platform.OS === 'android' ? 'portrait' : 'portraitUpsideDown');
      } else if (degree > -45) {
        setOrientation(Platform.OS === 'android' ? 'landscapeRight' : 'landscapeLeft');
      } else if (degree > -135) {
        setOrientation(Platform.OS === 'android' ? 'portraitUpsideDown' : 'portrait');
      } else {
        setOrientation(Platform.OS === 'android' ? 'landscapeLeft' : 'landscapeRight');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const ref = useRef<Camera>(null);

  const availableRatios = useMemo(
    () =>
      device?.formats.reduce<Record<string, CameraDeviceFormat[]>>((acc, format) => {
        const photoRatio = reduceRatio(format.photoWidth, format.photoHeight);
        const videoRatio = reduceRatio(format.videoWidth, format.videoHeight);

        return {
          ...acc,
          [`photo-${photoRatio}`]: [...(acc[`photo-${photoRatio}`] || []), format].sort(sortPhotoFormatsByResolution),
          [`video-${videoRatio}`]: [...(acc[`video-${videoRatio}`] || []), format].sort(sortVideoFormatsByResolution),
        };
      }, {}),
    [device?.formats]
  );

  const photoFormat = useMemo(() => {
    const format = availableRatios?.[`photo-${ratio}`]?.[0];
    if (format && Platform.OS === 'android') {
      return { ...format, photoHeight: format.photoWidth, photoWidth: format.photoHeight };
    }
    return format;
  }, [availableRatios, ratio]);

  const videoFormat = useMemo(() => {
    const format = availableRatios?.[`video-${ratio}`]?.[0];
    if (format && Platform.OS === 'android') {
      return { ...format, videoHeight: format.videoWidth, videoWidth: format.videoHeight };
    }
    return format;
  }, [availableRatios, ratio]);

  if (!device && devices.back) {
    setDevice(devices.back);
  }

  const toggleDevice = () => {
    setDevice((prev) => (prev === devices.back ? devices.front : devices.back));
  };

  const takePhoto = async (flash: FlashMode) => {
    const photo = await ref.current?.takePhoto({ qualityPrioritization: 'quality', flash });
    return photo;
  };

  const startRecording = async (
    flash: FlashMode,
    onError?: (error: CameraCaptureError) => void,
    onFinish?: (file: VideoFile) => void
  ) => {
    setIsRecording(true);
    return new Promise<VideoFile>((resolve, reject) => {
      ref.current?.startRecording({
        flash,
        onRecordingError: (err) => {
          setIsRecording(false);
          onError?.(err);
          // onError(err);
          reject(err);
        },
        onRecordingFinished: (file) => {
          setIsRecording(false);
          onFinish?.(file);
          // onFinish(file);
          resolve(file);
        },
      });
    });
    // ref.current?.startRecording({ flash, onRecordingError: onError, onRecordingFinished: onFinish });
  };

  const stopRecording = () => {
    setIsRecording(false);
    ref.current?.stopRecording();
  };

  return {
    device,
    toggleDevice,
    ref,
    takePhoto,
    startRecording,
    stopRecording,
    isRecording,
    photoFormat,
    videoFormat,
    orientation,
  };
}

const reduceRatio = (numerator: number, denominator: number): string => {
  let temp: number | undefined;
  let left: number;
  let right: number;

  const gcd = function (a: number, b: number): number {
    if (b === 0) {
      return a;
    }
    return gcd(b, a % b);
  };

  if (numerator === denominator) {
    return '1:1';
  }

  if (+numerator < +denominator) {
    temp = numerator;
    numerator = denominator;
    denominator = temp;
  }

  const divisor = gcd(+numerator, +denominator);

  if (typeof temp === 'undefined') {
    left = numerator / divisor;
    right = denominator / divisor;
  } else {
    left = denominator / divisor;
    right = numerator / divisor;
  }

  if (left === 8 && right === 5) {
    left = 16;
    right = 10;
  }

  return `${left}:${right}`;
};

function sortPhotoFormatsByResolution(left: CameraDeviceFormat, right: CameraDeviceFormat) {
  return right.photoHeight * right.photoWidth - left.photoHeight * left.photoWidth;
}

function sortVideoFormatsByResolution(left: CameraDeviceFormat, right: CameraDeviceFormat) {
  return right.videoHeight * right.videoWidth - left.videoHeight * left.videoWidth;
}
