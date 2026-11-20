import { AppConfig } from '../../../config/config';
import { CognitoIdpAdmin } from './cognito-admin';
import { IdentityProviderAdmin, NoopIdpAdmin } from './idp-admin';
import { KeycloakIdpAdmin } from './keycloak-admin';

/** Chọn driver theo IDP_ADMIN_DRIVER (UC8 spec mục 13). */
export function createIdpAdmin(cfg: AppConfig): IdentityProviderAdmin {
  switch (cfg.idpAdmin.driver) {
    case 'keycloak':
      return new KeycloakIdpAdmin(cfg.idpAdmin.keycloak);
    case 'cognito':
      return new CognitoIdpAdmin(cfg.idpAdmin.cognito);
    default:
      return new NoopIdpAdmin();
  }
}
