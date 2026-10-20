import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon } from '@/components/icon';
import { Card, Chip, T, tap } from '@/components/ui';
import { ArcadeButton, Comic } from '@/components/underground';
import { C, Space } from '@/constants/theme';
import { lookupBarcode, type FoodProduct } from '@/lib/barcode';
import { t } from '@/lib/i18n';
import { actions } from '@/lib/store';

const PORTIONS = [0.5, 1, 1.5, 2];

/** Scan a packaged food's barcode, check the label numbers, pick a portion and log it. */
export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [status, setStatus] = useState<'scanning' | 'looking' | 'notfound' | 'error'>('scanning');
  const [portion, setPortion] = useState(1);
  const busy = useRef(false);

  const onScan = async (code: string) => {
    if (busy.current || product) return;
    busy.current = true;
    tap();
    setStatus('looking');
    try {
      const p = await lookupBarcode(code);
      if (p) {
        setProduct(p);
        setPortion(1);
      } else setStatus('notfound');
    } catch {
      setStatus('error');
    } finally {
      busy.current = false;
    }
  };

  const rescan = () => {
    setProduct(null);
    setStatus('scanning');
  };

  const log = () => {
    if (!product) return;
    const n = product.perServing;
    actions.addEntry({
      kind: 'meal',
      title: product.brand ? `${product.name} (${product.brand})` : product.name,
      emoji: '🛒',
      nutrition: {
        calories: Math.round(n.calories * portion),
        protein: Math.round(n.protein * portion * 10) / 10,
        carbs: Math.round(n.carbs * portion * 10) / 10,
        fat: Math.round(n.fat * portion * 10) / 10,
        fiber: n.fiber != null ? Math.round(n.fiber * portion * 10) / 10 : undefined,
        sugar: n.sugar != null ? Math.round(n.sugar * portion * 10) / 10 : undefined,
      },
      items: [{ name: product.name, amount: `${portion} × ${product.servingLabel}`, calories: Math.round(n.calories * portion) }],
      source: 'photo',
      note: t('scan.scannedNote'),
    });
    router.back();
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {permission.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={status === 'scanning' ? ({ data }) => onScan(data) : undefined}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center, { padding: Space.lg, gap: 16 }]}>
          <Comic size={28}>{t('scan.cameraNeeded')}</Comic>
          <T size={14} color={C.textDim} style={{ textAlign: 'center' }}>
            {t('scan.cameraNeededBody')}
          </T>
          <ArcadeButton label={t('scan.allowCamera')} size="md" onPress={requestPermission} />
        </View>
      )}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Comic size={26}>{t('scan.title')}</Comic>
        <GlassButton icon="close" onPress={() => router.back()} />
      </View>

      {permission.granted && !product && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <View style={styles.frame} />
          <View style={styles.hint}>
            {status === 'looking' ? (
              <ActivityIndicator color={C.lime} />
            ) : (
              <T size={13} rounded color={status === 'scanning' ? C.text : C.orange}>
                {status === 'scanning' ? t('scan.pointAtBarcode') : status === 'notfound' ? t('scan.notFound') : t('scan.lookupFailed')}
              </T>
            )}
          </View>
        </View>
      )}

      {(status === 'notfound' || status === 'error') && !product && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <T size={13} color={C.textDim} style={{ textAlign: 'center' }}>
            {status === 'notfound' ? t('scan.notFoundHint') : t('scan.errorHint')}
          </T>
          <ArcadeButton label={t('scan.scanAgain')} size="md" onPress={rescan} />
        </View>
      )}

      {product && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Card style={{ gap: 10 }} accent={C.lime + '99'}>
            <View style={{ gap: 2 }}>
              {!!product.brand && (
                <T size={11} rounded color={C.textMute}>
                  {product.brand.toUpperCase()}
                </T>
              )}
              <T size={18} rounded color={C.text}>
                {product.name}
              </T>
              <T size={12} color={C.textDim}>
                {t('scan.perServing', { serving: product.servingLabel })}
              </T>
            </View>
            <View style={styles.macros}>
              <Macro label={t('scan.kcal')} value={product.perServing.calories * portion} color={C.text} />
              <Macro label={t('scan.protein')} value={product.perServing.protein * portion} color={C.protein} unit="g" />
              <Macro label={t('scan.carbs')} value={product.perServing.carbs * portion} color={C.carbs} unit="g" />
              <Macro label={t('scan.fat')} value={product.perServing.fat * portion} color={C.fat} unit="g" />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PORTIONS.map((p) => (
                <Chip key={p} label={`${p}×`} active={portion === p} onPress={() => setPortion(p)} />
              ))}
            </View>
          </Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ArcadeButton label={t('scan.rescan')} size="md" colors={['#5E6468', '#3A3F43']} textColor="#fff" onPress={rescan} style={{ flex: 1 }} />
            <ArcadeButton label={t('scan.logIt')} size="md" onPress={log} icon={<Icon name="check" size={20} color="#FF7A1A" weight="bold" />} style={{ flex: 2 }} />
          </View>
        </View>
      )}
    </View>
  );
}

function Macro({ label, value, color, unit = '' }: { label: string; value: number; color: string; unit?: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <T size={20} rounded color={color}>
        {Math.round(value)}
        {unit}
      </T>
      <T size={9} rounded color={C.textMute}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.md, paddingBottom: 12, backgroundColor: 'rgba(11,12,13,0.6)' },
  frame: { width: 280, height: 160, borderRadius: 16, borderWidth: 3, borderColor: C.lime, shadowColor: C.lime, shadowOpacity: 0.9, shadowRadius: 12 },
  hint: { marginTop: 18, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(11,12,13,0.75)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 12, padding: Space.md, backgroundColor: 'rgba(11,12,13,0.92)', borderTopWidth: 2, borderTopColor: C.ink },
  macros: { flexDirection: 'row', paddingVertical: 6, borderRadius: 8, backgroundColor: '#15181A' },
});
