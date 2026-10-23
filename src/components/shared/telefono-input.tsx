"use client";

import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

interface TelefonoInputProps {
  id?: string;
  value: string;
  onChange: (telefono: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

/** Entrada de telefono con selector de pais y prefijo internacional. */
export function TelefonoInput({
  id,
  value,
  onChange,
  error,
  disabled = false,
  placeholder = "+51 987 654 321",
}: TelefonoInputProps) {
  const telefono = value.replace(/\D/g, "");

  return (
    <PhoneInput
      country="pe"
      value={telefono}
      onChange={(phone) => {
        onChange(phone ? `+${phone}` : "");
      }}
      enableSearch
      preferredCountries={["pe"]}
      countryCodeEditable={false}
      placeholder={placeholder}
      searchPlaceholder="Buscar pais o codigo..."
      searchNotFound="Sin resultados"
      inputProps={{ id, "aria-label": "Telefono" }}
      containerClass="w-full"
      inputClass="!h-10 !text-sm"
      buttonClass="!border-input"
      dropdownClass="!z-[80]"
      searchClass="!text-sm"
      inputStyle={{
        width: "100%",
        height: "40px",
        fontSize: "14px",
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        borderColor: error ? "var(--destructive)" : "var(--input)",
        borderRadius: "6px",
        paddingLeft: "52px",
      }}
      buttonStyle={{
        backgroundColor: "var(--background)",
        borderColor: error ? "var(--destructive)" : "var(--input)",
        borderRadius: "6px 0 0 6px",
        zIndex: 2,
      }}
      dropdownStyle={{
        backgroundColor: "var(--popover)",
        color: "var(--popover-foreground)",
        borderColor: "var(--border)",
        zIndex: 80,
      }}
      searchStyle={{
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        borderColor: "var(--border)",
      }}
      disabled={disabled}
    />
  );
}
