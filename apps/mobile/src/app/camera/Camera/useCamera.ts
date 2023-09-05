import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { gravity, SensorTypes, setUpdateIntervalForType } from 'react-native-sensors';
import { Camera, CameraDevice, CameraDeviceFormat, sortFormats, useCameraDevices } from 'react-native-vision-camera';

setUpdateIntervalForType(SensorTypes.gravity, 1000);
// DeviceMotion.setUpdateInterval(1000);

export function useCamera(ratio: '16:9' | '4:3' = '16:9') {
  const devices = useCameraDevices();
  const [device, setDevice] = useState<CameraDevice | undefined>();
  const [orientation, setOrientation] = useState<
    'portrait' | 'portraitUpsideDown' | 'landscapeLeft' | 'landscapeRight'
  >('portrait');

  useEffect(() => {
    // DeviceMotion.addListener(({ orientation, rotation }) => {
    //   console.log('rotationnnnnn', orientation, calculateOrientation(rotation.gamma, rotation.beta));
    // });
    // return () => {
    //   DeviceMotion.removeAllListeners();
    // };
  }, []);

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
          // use 'sortFormats' from 'react-native-vision-camera' to get the best resolutions first
          [`photo-${photoRatio}`]: [...(acc[`photo-${photoRatio}`] || []), format].sort(sortFormats),
          [`video-${videoRatio}`]: [...(acc[`video-${videoRatio}`] || []), format].sort(sortFormats),
        };
      }, {}),
    [device?.formats]
  );

  const photoFormat = useMemo(() => {
    const format = availableRatios?.[`photo-${ratio}`]?.[0];
    if (format && Platform.OS === 'android') {
      [format.photoHeight, format.photoWidth] = [format.photoWidth, format.photoHeight];
      [format.videoHeight, format.videoWidth] = [format.videoWidth, format.videoHeight];
    }
    return format;
  }, [availableRatios, ratio]);

  const videoFormat = useMemo(() => {
    const format = availableRatios?.[`video-${ratio}`]?.[0];
    if (format && Platform.OS === 'android') {
      [format.photoHeight, format.photoWidth] = [format.photoWidth, format.photoHeight];
      [format.videoHeight, format.videoWidth] = [format.videoWidth, format.videoHeight];
    }
    return format;
  }, [availableRatios, ratio]);

  if (!device && devices.back) {
    setDevice(devices.back);
  }

  const toggleDevice = () => {
    setDevice((prev) => (prev === devices.back ? devices.front : devices.back));
  };

  const takePhoto = async () => {
    const photo = await ref.current?.takePhoto({ qualityPrioritization: 'quality', flash: 'auto' });
    return photo;
  };

  return { device, toggleDevice, ref, takePhoto, photoFormat, videoFormat, orientation };
}

// function calculateOrientation(gamma: number, beta: number) {
//   const radian = Math.atan2(gamma, beta);
//   const degree = (radian * 180) / Math.PI;
//   let rotation: Rotation = 'left';
//   if (degree > -135) rotation = 'top';
//   if (degree > -45) rotation = 'right';
//   if (degree > 45) rotation = 'down';
//   if (degree > 135) rotation = 'left';
//   // if (Platform.OS === 'android') {
//   //   rotation = 'right';
//   //   if (degree > -135) rotation = 'down';
//   //   if (degree > -45) rotation = 'left';
//   //   if (degree > 45) rotation = 'top';
//   //   if (degree > 135) rotation = 'right';
//   // }

//   console.log('rotation', rotation);

//   const ABSOLUTE_GAMMA = Math.abs(gamma);
//   const ABSOLUTE_BETA = Math.abs(beta);
//   const isGammaNegative = Math.sign(gamma) === -1;
//   let orientation = 0;

//   if (ABSOLUTE_GAMMA <= 0.04 && ABSOLUTE_BETA <= 0.24) {
//     //Portrait mode, on a flat surface.
//     orientation = 0;
//   } else if ((ABSOLUTE_GAMMA <= 1.0 || ABSOLUTE_GAMMA >= 2.3) && ABSOLUTE_BETA >= 0.5) {
//     //General Portrait mode, accounting for forward and back tilt on the top of the phone.
//     orientation = 180;
//   } else {
//     if (isGammaNegative) {
//       //Landscape mode with the top of the phone to the left.
//       orientation = -90;
//     } else {
//       //Landscape mode with the top of the phone to the right.
//       orientation = 90;
//     }
//   }
//   return orientation;
// }

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
    // eslint-disable-next-line no-param-reassign
    numerator = denominator;
    // eslint-disable-next-line no-param-reassign
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
