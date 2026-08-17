"use client";

// Petit bouton client réutilisable pour les actions destructrices : il
// demande confirmation avant de laisser le formulaire parent se
// soumettre. Le reste de l'application reste en composants serveur.
export function ConfirmSubmitButton({
  message,
  className,
  style,
  children,
  formAction,
}: {
  message: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  formAction?: (formData: FormData) => void;
}) {
  return (
    <button
      type="submit"
      formAction={formAction}
      className={className}
      style={style}
      onClick={(e) => {
        if (!confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
