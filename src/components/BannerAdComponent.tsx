import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

export const PRODUCTION_BANNER_ID = 'ca-app-pub-8215887949442177/2445750148';

interface Props {
  adUnitId?: string;
}

export const BannerAdComponent: React.FC<Props> = ({ adUnitId }) => {
  if (Platform.OS === 'web') return null;

  const targetUnitId = adUnitId || (__DEV__ ? TestIds.BANNER : PRODUCTION_BANNER_ID);

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={targetUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    width: '100%',
  },
});
