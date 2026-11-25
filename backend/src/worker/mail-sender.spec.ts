import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { SesMailSender } from './mail-sender';

describe('SesMailSender (staging-readiness F1)', () => {
  const setup = () => {
    const send = jest.fn().mockResolvedValue({ MessageId: 'm-1' });
    return { send, sender: new SesMailSender({ send } as never) };
  };
  const input = (send: jest.Mock, i = 0) => (send.mock.calls[i][0] as SendEmailCommand).input;

  it('một người nhận: đặt ở To, nội dung UTF-8', async () => {
    const { send, sender } = setup();
    await sender.sendMail({ from: 'no-reply@hr.example', to: 'a@x.vn', subject: 'Đơn nghỉ', text: 'Nội dung' });
    expect(send).toHaveBeenCalledTimes(1);
    const cmd = input(send);
    expect(cmd.FromEmailAddress).toBe('no-reply@hr.example');
    expect(cmd.Destination).toEqual({ ToAddresses: ['a@x.vn'] });
    expect(cmd.Content?.Simple?.Subject).toEqual({ Data: 'Đơn nghỉ', Charset: 'UTF-8' });
    expect(cmd.Content?.Simple?.Body?.Text).toEqual({ Data: 'Nội dung', Charset: 'UTF-8' });
  });

  it('nhiều người nhận: đặt ở Bcc để không lộ địa chỉ của nhau (BR-15)', async () => {
    const { send, sender } = setup();
    await sender.sendMail({ from: 'no-reply@hr.example', to: 'a@x.vn, b@x.vn', subject: 's', text: 't' });
    expect(input(send).Destination).toEqual({ ToAddresses: ['no-reply@hr.example'], BccAddresses: ['a@x.vn', 'b@x.vn'] });
  });

  it('quá 49 người nhận thì chia lô (SES tối đa 50 địa chỉ mỗi email)', async () => {
    const { send, sender } = setup();
    const to = Array.from({ length: 100 }, (_, i) => `u${i}@x.vn`).join(',');
    await sender.sendMail({ from: 'no-reply@hr.example', to, subject: 's', text: 't' });
    expect(send).toHaveBeenCalledTimes(3);
    expect(input(send, 2).Destination?.BccAddresses).toHaveLength(2);
  });

  it('không có người nhận thì không gọi SES', async () => {
    const { send, sender } = setup();
    await sender.sendMail({ from: 'no-reply@hr.example', to: ' ', subject: 's', text: 't' });
    expect(send).not.toHaveBeenCalled();
  });
});
