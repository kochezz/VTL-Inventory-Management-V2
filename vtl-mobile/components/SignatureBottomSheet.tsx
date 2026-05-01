import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SheetField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: { label: string; value: string }[];
  placeholder?: string;
  optional?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  fields: SheetField[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

// ── Select picker (inline segmented style) ────────────────────────────────────

function SelectField({
  field,
  value,
  onChange,
}: {
  field: SheetField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.fieldBlock}>
      <Text style={s.fieldLabel}>{field.label}</Text>
      <View style={s.optionsRow}>
        {(field.options ?? []).map((opt) => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[s.optionChip, active && s.optionChipActive]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={[s.optionText, active && s.optionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SignatureBottomSheet({
  visible,
  title,
  fields,
  submitLabel = 'Submit',
  onSubmit,
  onClose,
}: Props) {
  const initValues = () =>
    Object.fromEntries(
      fields
        .filter((f) => f.type === 'select' && f.options?.length)
        .map((f) => [f.key, f.options![0].value])
    );

  const [values, setValues] = useState<Record<string, string>>(initValues);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setValues(initValues());
    setPassword('');
    setError('');
    setSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!password.trim()) {
      setError('Digital signature password is required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ ...values, signature_password: password });
      handleClose();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key: string, val: string) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={handleClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.sheetWrapper}
      >
        <View style={s.sheet}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Title row */}
          <View style={s.titleRow}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={s.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Dynamic fields */}
            {fields.map((field) => {
              if (field.type === 'select') {
                return (
                  <SelectField
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? field.options?.[0]?.value ?? ''}
                    onChange={(v) => set(field.key, v)}
                  />
                );
              }
              return (
                <View key={field.key} style={s.fieldBlock}>
                  <Text style={s.fieldLabel}>
                    {field.label}
                    {field.optional && (
                      <Text style={s.optionalTag}> (optional)</Text>
                    )}
                  </Text>
                  <TextInput
                    style={[s.input, field.type === 'textarea' && s.textarea]}
                    value={values[field.key] ?? ''}
                    onChangeText={(v) => set(field.key, v)}
                    placeholder={field.placeholder ?? ''}
                    placeholderTextColor={COLORS.muted}
                    multiline={field.type === 'textarea'}
                    numberOfLines={field.type === 'textarea' ? 3 : 1}
                    textAlignVertical={field.type === 'textarea' ? 'top' : 'center'}
                  />
                </View>
              );
            })}

            {/* Divider */}
            <View style={s.sigDivider} />

            {/* Signature password — always last */}
            <View style={s.fieldBlock}>
              <Text style={s.sigLabel}>🔐 Digital Signature</Text>
              <Text style={s.sigHint}>
                Enter your account password to confirm this action.
              </Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* Error */}
            {!!error && <Text style={s.errorText}>{error}</Text>}

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, submitting && s.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.submitBtnText}>{submitLabel}</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheetWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:        { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, maxHeight: '90%' },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  title:    { color: COLORS.text, fontSize: 17, fontWeight: '700', flex: 1 },
  closeBtn: { color: COLORS.muted, fontSize: 18, paddingLeft: 12 },

  body: { paddingHorizontal: 20 },

  fieldBlock:  { marginBottom: 16 },
  fieldLabel:  { color: COLORS.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  optionalTag: { color: COLORS.muted, fontSize: 11, fontWeight: '400', textTransform: 'none' },

  input:    { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, color: COLORS.text, fontSize: 14, paddingHorizontal: 14, paddingVertical: 10 },
  textarea: { minHeight: 80, paddingTop: 10 },

  optionsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip:      { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  optionChipActive:{ borderColor: COLORS.sky, backgroundColor: COLORS.sky + '22' },
  optionText:      { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  optionTextActive:{ color: COLORS.sky },

  sigDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  sigLabel:   { color: COLORS.text, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  sigHint:    { color: COLORS.muted, fontSize: 12, marginBottom: 10 },

  errorText: { color: COLORS.red, fontSize: 13, textAlign: 'center', marginBottom: 12, marginTop: -4 },

  submitBtn:         { backgroundColor: COLORS.sky, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
});
