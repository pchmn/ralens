import { Platform } from 'react-native';

type Elevation = 0 | 1 | 2 | 3 | 4 | 5;

const iOSShadow = [
  {
    shadowOpacity: 0.15,
    height: [0, 1, 2, 4, 6, 8],
    shadowRadius: [0, 3, 6, 8, 10, 12],
  },
  {
    shadowOpacity: 0.3,
    height: [0, 1, 1, 1, 2, 4],
    shadowRadius: [0, 1, 2, 3, 3, 4],
  },
];

const androidElevationLevel = [0, 3, 6, 9, 12, 15];

export function shadow(elevation: Elevation) {
  if (Platform.OS === 'android') {
    return {
      elevation: androidElevationLevel[elevation],
    };
  }

  return {
    shadowColor: '#000',
    shadowOpacity: elevation ? iOSShadow[0].shadowOpacity : 0,
    shadowOffset: {
      width: 0,
      height: iOSShadow[0].shadowOpacity,
    },
    shadowRadius: iOSShadow[0].shadowRadius[elevation],
  };
}
